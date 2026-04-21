/**
 * Claude Skills — Load Claude-style SKILL.md files as SignalWire agent tools.
 *
 * Tier 3 built-in skill that parses Claude Code skill directories and makes
 * them available as SWAIG tools the AI can call. Each Claude skill becomes a
 * tool that returns the skill's instructions when invoked.
 *
 * Port of Python SDK's `signalwire_agents/skills/claude_skills/skill.py`.
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { resolve, join, relative, basename, extname, sep } from 'node:path';
import { execSync } from 'node:child_process';

import yaml from 'js-yaml';

import { SkillBase } from '../SkillBase.js';
import type {
  SkillToolDefinition,
  SkillPromptSection,
  SkillConfig,
  ParameterSchemaEntry,
} from '../SkillBase.js';
import { FunctionResult } from '../../FunctionResult.js';
import { getLogger } from '../../Logger.js';

const log = getLogger('ClaudeSkillsSkill');

// Frontmatter fields that are parsed but not supported in SignalWire agents
const _UNSUPPORTED_FIELDS: Record<string, string> = {
  context:
    "context: fork is not supported in SignalWire agents — skill '{name}' will run inline, not in a subagent",
  agent:
    "agent field is not supported in SignalWire agents — skill '{name}' cannot select a subagent type",
  'allowed-tools':
    "allowed-tools is not supported in SignalWire agents — skill '{name}' tool restrictions will not be enforced",
  model:
    "model field is not supported in SignalWire agents — skill '{name}' model selection is controlled at the agent level",
  hooks:
    "hooks field is not supported in SignalWire agents — skill '{name}' lifecycle hooks will not fire",
};

// Regex for shell injection patterns: !`command`
const _SHELL_INJECTION_RE = /!`([^`]+)`/g;

/** Internal representation of a parsed Claude skill. */
interface ParsedSkill {
  name: string;
  description: string | null;
  body: string;
  path: string;
  skillDir: string;
  sections: Map<string, string>;
  files: Record<string, string[]>;
  disableModelInvocation: boolean;
  userInvocable: boolean;
  argumentHint: string | null;
  license: string | null;
  compatibility: string | null;
  context: unknown;
  agent: unknown;
  allowedTools: unknown;
  model: unknown;
  hooks: unknown;
  _skipTool: boolean;
  _skipPrompt: boolean;
}

/**
 * Load Claude-style SKILL.md files as SignalWire agent tools.
 *
 * This skill parses Claude Code skill directories and makes them available
 * as SWAIG tools that the AI can call. Each Claude skill becomes a tool
 * that returns the skill's instructions when invoked.
 */
export class ClaudeSkillsSkill extends SkillBase {
  // Python ground truth: skills/claude_skills/skill.py
  // Python REQUIRED_PACKAGES = ["yaml"]; TS uses js-yaml but kept [] historically.
  static override SKILL_NAME = 'claude_skills';
  static override SKILL_DESCRIPTION = 'Load Claude SKILL.md files as agent tools';
  static override SKILL_VERSION = '1.0.0';
  static override REQUIRED_ENV_VARS: readonly string[] = [];
  static override SUPPORTS_MULTIPLE_INSTANCES = true;

  private _skillsPath = '';
  private _includePatterns: string[] = ['*'];
  private _excludePatterns: string[] = [];
  private _allowShellInjection = false;
  private _allowScriptExecution = false;
  private _ignoreInvocationControl = false;
  private _shellTimeout = 30;
  private _skills: ParsedSkill[] = [];

  static override getParameterSchema(): Record<string, ParameterSchemaEntry> {
    return {
      ...super.getParameterSchema(),
      skills_path: {
        type: 'string',
        description:
          'Path to directory containing Claude skill folders (each with SKILL.md)',
        required: true,
      },
      include: {
        type: 'array',
        description: "Glob patterns for skills to include (default: ['*'])",
        default: ['*'],
      },
      exclude: {
        type: 'array',
        description: 'Glob patterns for skills to exclude',
        default: [],
      },
      prompt_title: {
        type: 'string',
        description: 'Title for the prompt section listing skills',
        default: 'Claude Skills',
      },
      prompt_intro: {
        type: 'string',
        description: 'Introductory text for the prompt section',
        default:
          'You have access to specialized skills. Call the appropriate tool when the user\'s question matches:',
      },
      skill_descriptions: {
        type: 'object',
        description:
          'Override descriptions for specific skills (skill_name -> description)',
        default: {},
      },
      tool_prefix: {
        type: 'string',
        description:
          "Prefix for generated tool names (default: 'claude_'). Use empty string for no prefix.",
        default: 'claude_',
      },
      response_prefix: {
        type: 'string',
        description:
          'Text to prepend to skill results (e.g., instructions for the AI)',
        default: '',
      },
      response_postfix: {
        type: 'string',
        description:
          'Text to append to skill results (e.g., reminders or constraints)',
        default: '',
      },
      allow_shell_injection: {
        type: 'boolean',
        description:
          'Enable !`command` preprocessing in skill bodies. DANGEROUS: allows arbitrary shell execution.',
        default: false,
      },
      allow_script_execution: {
        type: 'boolean',
        description:
          'Discover and list scripts/, assets/ files in prompt sections',
        default: false,
      },
      ignore_invocation_control: {
        type: 'boolean',
        description:
          'Override disable-model-invocation and user-invocable flags, register everything',
        default: false,
      },
      shell_timeout: {
        type: 'integer',
        description: 'Timeout in seconds for shell injection commands',
        default: 30,
      },
    };
  }

  /**
   * Setup the Claude skills loader — discovers and parses all SKILL.md files.
   *
   * Returns `true` on success and `false` on any failure (missing path,
   * invalid path, stat failure, or non-directory), mirroring the Python
   * skill's `setup() -> bool` contract.
   */
  override async setup(): Promise<boolean> {
    const skillsPath = this.getConfig<string>('skills_path');
    if (!skillsPath) {
      log.error('claude_skills: skills_path parameter is required');
      return false;
    }

    this._skillsPath = resolve(skillsPath);

    if (!existsSync(this._skillsPath)) {
      log.error(`claude_skills: skills_path does not exist: ${this._skillsPath}`);
      return false;
    }

    let stat;
    try {
      stat = statSync(this._skillsPath);
    } catch {
      log.error(`claude_skills: cannot stat skills_path: ${this._skillsPath}`);
      return false;
    }
    if (!stat.isDirectory()) {
      log.error(
        `claude_skills: skills_path is not a directory: ${this._skillsPath}`,
      );
      return false;
    }

    // Load include/exclude patterns
    this._includePatterns = this.getConfig<string[]>('include', ['*']);
    this._excludePatterns = this.getConfig<string[]>('exclude', []);

    // Store safety/control flags
    this._allowShellInjection = this.getConfig<boolean>(
      'allow_shell_injection',
      false,
    );
    this._allowScriptExecution = this.getConfig<boolean>(
      'allow_script_execution',
      false,
    );
    this._ignoreInvocationControl = this.getConfig<boolean>(
      'ignore_invocation_control',
      false,
    );
    this._shellTimeout = this.getConfig<number>('shell_timeout', 30);

    if (this._allowShellInjection) {
      log.warn(
        'claude_skills: allow_shell_injection is enabled — ' +
          'skill bodies may execute arbitrary shell commands',
      );
    }

    // Discover and parse skills
    this._skills = this._discoverSkills();

    if (this._skills.length === 0) {
      log.warn(`claude_skills: no skills found in ${this._skillsPath}`);
    }

    log.info(
      `claude_skills: loaded ${this._skills.length} skills from ${this._skillsPath}`,
    );
    return true;
  }

  // ---------------------------------------------------------------------------
  // Discovery
  // ---------------------------------------------------------------------------

  private _discoverSkills(): ParsedSkill[] {
    const skills: ParsedSkill[] = [];
    let entries: string[];

    try {
      entries = readdirSync(this._skillsPath);
    } catch {
      log.error(
        `claude_skills: failed to read skills directory: ${this._skillsPath}`,
      );
      return skills;
    }

    for (const entry of entries) {
      const entryPath = join(this._skillsPath, entry);
      let stat;
      try {
        stat = statSync(entryPath);
      } catch {
        continue;
      }
      if (!stat.isDirectory()) continue;

      const skillFile = join(entryPath, 'SKILL.md');
      if (!existsSync(skillFile)) continue;

      // Check include/exclude patterns
      if (!this._matchesPatterns(entry)) {
        log.debug(`claude_skills: skipping ${entry} (excluded by patterns)`);
        continue;
      }

      // Parse the skill
      const parsed = this._parseSkillMd(skillFile);
      if (!parsed) continue;

      // Use directory name as fallback for skill name
      if (!parsed.name) {
        parsed.name = entry;
      }
      parsed.path = skillFile;
      parsed.skillDir = entryPath;

      // Discover supporting files (all .md files except SKILL.md)
      parsed.sections = this._discoverSections(entryPath);

      // Discover non-.md files if script execution is enabled
      if (this._allowScriptExecution) {
        parsed.files = this._discoverAllFiles(entryPath);
      } else {
        parsed.files = {};
      }

      // Warn about unsupported frontmatter fields
      this._warnUnsupportedFields(parsed);

      // Warn about shell injection patterns if disabled
      if (!this._allowShellInjection) {
        this._warnShellPatterns(parsed);
      }

      // Determine invocation control flags
      this._applyInvocationControl(parsed);

      skills.push(parsed);
      const sectionCount = parsed.sections.size;
      log.debug(
        `claude_skills: loaded skill '${parsed.name}' from ${skillFile} with ${sectionCount} sections`,
      );
    }

    return skills;
  }

  private _discoverSections(skillDir: string): Map<string, string> {
    const sections = new Map<string, string>();
    this._discoverSectionsRecursive(skillDir, skillDir, sections);
    return sections;
  }

  private _discoverSectionsRecursive(
    baseDir: string,
    currentDir: string,
    sections: Map<string, string>,
  ): void {
    let entries: string[];
    try {
      entries = readdirSync(currentDir);
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = join(currentDir, entry);
      let stat;
      try {
        stat = statSync(fullPath);
      } catch {
        continue;
      }

      if (stat.isDirectory()) {
        this._discoverSectionsRecursive(baseDir, fullPath, sections);
        continue;
      }

      if (!stat.isFile()) continue;
      if (extname(entry).toLowerCase() !== '.md') continue;
      if (entry.toUpperCase() === 'SKILL.MD') continue;

      // Calculate relative path from skill dir
      const rel = relative(baseDir, fullPath);
      const relParts = rel.split(sep);
      const stem = basename(entry, '.md');

      let key: string;
      if (relParts.length > 1) {
        // Nested file: include parent path
        const parentPath = relParts.slice(0, -1).join('/');
        key = `${parentPath}/${stem}`;
      } else {
        key = stem;
      }

      // Normalize path separators
      key = key.replace(/\\/g, '/');
      sections.set(key, fullPath);
    }
  }

  private _discoverAllFiles(
    skillDir: string,
  ): Record<string, string[]> {
    const files: Record<string, string[]> = {
      scripts: [],
      assets: [],
      other: [],
    };

    this._discoverAllFilesRecursive(skillDir, skillDir, files);

    // Sort for deterministic output
    files.scripts.sort();
    files.assets.sort();
    files.other.sort();

    return files;
  }

  private _discoverAllFilesRecursive(
    baseDir: string,
    currentDir: string,
    files: Record<string, string[]>,
  ): void {
    let entries: string[];
    try {
      entries = readdirSync(currentDir);
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = join(currentDir, entry);
      let stat;
      try {
        stat = statSync(fullPath);
      } catch {
        continue;
      }

      if (stat.isDirectory()) {
        // Skip hidden dirs and __pycache__
        if (entry.startsWith('.') || entry === '__pycache__' || entry === 'node_modules') continue;
        this._discoverAllFilesRecursive(baseDir, fullPath, files);
        continue;
      }

      if (!stat.isFile()) continue;

      // Skip .md files (handled by _discoverSections)
      if (extname(entry).toLowerCase() === '.md') continue;

      // Skip hidden files
      if (entry.startsWith('.')) continue;

      const rel = relative(baseDir, fullPath).replace(/\\/g, '/');
      const parts = rel.split('/');

      // Categorize by top-level directory
      if (parts[0] === 'scripts') {
        files.scripts.push(rel);
      } else if (parts[0] === 'assets') {
        files.assets.push(rel);
      } else {
        files.other.push(rel);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Parsing
  // ---------------------------------------------------------------------------

  private _parseSkillMd(
    filePath: string,
  ): ParsedSkill | null {
    let content: string;
    try {
      content = readFileSync(filePath, 'utf-8');
    } catch (err) {
      log.error(
        `claude_skills: failed to read ${filePath}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }

    // Check for YAML frontmatter
    if (!content.startsWith('---')) {
      // No frontmatter — treat entire content as body
      return this._buildParsedSkill(null, null, content.trim());
    }

    // Split frontmatter from body
    const parts = content.split('---', 3);
    if (parts.length < 3) {
      // Malformed frontmatter
      log.warn(`claude_skills: malformed frontmatter in ${filePath}`);
      return this._buildParsedSkill(null, null, content.trim());
    }

    const frontmatterStr = parts[1].trim();
    const body = parts[2].trim();

    // Parse YAML frontmatter
    let frontmatter: Record<string, unknown> = {};
    try {
      const parsed = yaml.load(frontmatterStr);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        frontmatter = parsed as Record<string, unknown>;
      }
    } catch (err) {
      log.warn(
        `claude_skills: failed to parse YAML in ${filePath}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    return this._buildParsedSkill(
      (frontmatter['name'] as string) ?? null,
      (frontmatter['description'] as string) ?? null,
      body,
      frontmatter,
    );
  }

  private _buildParsedSkill(
    name: string | null,
    description: string | null,
    body: string,
    frontmatter?: Record<string, unknown>,
  ): ParsedSkill {
    const fm = frontmatter ?? {};
    return {
      name: name ?? '',
      description,
      body,
      path: '',
      skillDir: '',
      sections: new Map(),
      files: {},
      disableModelInvocation: (fm['disable-model-invocation'] as boolean) ?? false,
      userInvocable: fm['user-invocable'] !== undefined ? (fm['user-invocable'] as boolean) : true,
      argumentHint: (fm['argument-hint'] as string) ?? null,
      license: (fm['license'] as string) ?? null,
      compatibility: (fm['compatibility'] as string) ?? null,
      context: fm['context'] ?? null,
      agent: fm['agent'] ?? null,
      allowedTools: fm['allowed-tools'] ?? null,
      model: fm['model'] ?? null,
      hooks: fm['hooks'] ?? null,
      _skipTool: false,
      _skipPrompt: false,
    };
  }

  // ---------------------------------------------------------------------------
  // Pattern matching
  // ---------------------------------------------------------------------------

  private _matchesPatterns(name: string): boolean {
    // Check excludes first
    for (const pattern of this._excludePatterns) {
      if (this._fnmatch(name, pattern)) return false;
    }
    // Check includes
    for (const pattern of this._includePatterns) {
      if (this._fnmatch(name, pattern)) return true;
    }
    return false;
  }

  /** Simple fnmatch implementation: `*` → `.*`, `?` → `.`, escape the rest. */
  private _fnmatch(name: string, pattern: string): boolean {
    // Convert glob pattern to regex
    let regex = '^';
    for (const ch of pattern) {
      if (ch === '*') regex += '.*';
      else if (ch === '?') regex += '.';
      else if ('.+^${}()|[]\\'.includes(ch)) regex += '\\' + ch;
      else regex += ch;
    }
    regex += '$';
    return new RegExp(regex, 'i').test(name);
  }

  // ---------------------------------------------------------------------------
  // Warning helpers
  // ---------------------------------------------------------------------------

  private _warnUnsupportedFields(parsed: ParsedSkill): void {
    const name = parsed.name || 'unknown';

    const fieldMapping: [keyof ParsedSkill, string][] = [
      ['context', 'context'],
      ['agent', 'agent'],
      ['allowedTools', 'allowed-tools'],
      ['model', 'model'],
      ['hooks', 'hooks'],
    ];

    for (const [parsedKey, frontmatterKey] of fieldMapping) {
      const value = parsed[parsedKey];
      if (value !== null && value !== undefined) {
        const msg = _UNSUPPORTED_FIELDS[frontmatterKey].replace(
          '{name}',
          name,
        );
        log.warn(`claude_skills: ${msg}`);
      }
    }

    // Log informational fields at debug level
    if (parsed.license) {
      log.debug(
        `claude_skills: skill '${name}' has license: ${parsed.license}`,
      );
    }
    if (parsed.compatibility) {
      log.debug(
        `claude_skills: skill '${name}' has compatibility: ${parsed.compatibility}`,
      );
    }
  }

  private _warnShellPatterns(parsed: ParsedSkill): void {
    const name = parsed.name || 'unknown';
    const body = parsed.body || '';

    // Reset regex state (global flag)
    const re = /!`([^`]+)`/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(body)) !== null) {
      const command = match[1];
      log.warn(
        'claude_skills: shell injection pattern `!' + command + '` found in skill ' +
          `'${name}' but allow_shell_injection is disabled — pattern will be ` +
          'passed through as-is. Set allow_shell_injection=True to enable.',
      );
    }
  }

  private _applyInvocationControl(parsed: ParsedSkill): void {
    if (this._ignoreInvocationControl) {
      parsed._skipTool = false;
      parsed._skipPrompt = false;
      return;
    }

    if (parsed.disableModelInvocation) {
      // disable-model-invocation: true → no tool, no prompt
      parsed._skipTool = true;
      parsed._skipPrompt = true;
      log.debug(
        `claude_skills: skill '${parsed.name}' has disable-model-invocation=true — skipping tool and prompt`,
      );
    } else if (!parsed.userInvocable) {
      // user-invocable: false → no tool, yes prompt (knowledge-only)
      parsed._skipTool = true;
      parsed._skipPrompt = false;
      log.debug(
        `claude_skills: skill '${parsed.name}' has user-invocable=false — skipping tool, keeping prompt`,
      );
    } else {
      // Default: register both
      parsed._skipTool = false;
      parsed._skipPrompt = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Name sanitization
  // ---------------------------------------------------------------------------

  private _sanitizeToolName(name: string): string {
    // Replace hyphens and spaces with underscores
    let sanitized = name.toLowerCase().replace(/[-\s]+/g, '_');
    // Remove any other invalid characters
    sanitized = sanitized.replace(/[^a-z0-9_]/g, '');
    // Ensure it doesn't start with a number
    if (sanitized.length > 0 && /^\d/.test(sanitized)) {
      sanitized = '_' + sanitized;
    }
    return sanitized || 'unnamed';
  }

  // ---------------------------------------------------------------------------
  // Content processing
  // ---------------------------------------------------------------------------

  private _executeShellInjection(
    content: string,
    skillDir: string,
    timeout: number,
  ): string {
    return content.replace(/!`([^`]+)`/g, (_match, command: string) => {
      try {
        const result = execSync(command, {
          cwd: skillDir,
          timeout: timeout * 1000,
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        return result.replace(/\n$/, '');
      } catch (err: unknown) {
        if (
          err &&
          typeof err === 'object' &&
          'killed' in err &&
          (err as { killed: boolean }).killed
        ) {
          log.error(
            `claude_skills: shell command timed out after ${timeout}s: ${command}`,
          );
          return `[command timed out: ${command}]`;
        }
        log.error(`claude_skills: shell command failed: ${command}: ${err instanceof Error ? err.message : String(err)}`);
        return `[command error: ${command}]`;
      }
    });
  }

  private _substituteVariables(
    content: string,
    skillDir: string,
    rawData?: Record<string, unknown>,
  ): string {
    content = content.replace(/\$\{CLAUDE_SKILL_DIR\}/g, skillDir);

    let sessionId = '';
    if (rawData) {
      sessionId = (rawData['call_id'] as string) ?? '';
    }
    content = content.replace(/\$\{CLAUDE_SESSION_ID\}/g, sessionId);

    return content;
  }

  private _substituteArguments(body: string, arguments_: string): string {
    if (!arguments_) arguments_ = '';

    // Check if body contains bare $ARGUMENTS before substitution
    const hasBareArguments = /\$ARGUMENTS(?!\[)/.test(body);

    // Split into positional args
    const positional = arguments_ ? arguments_.split(/\s+/) : [];

    // Replace $ARGUMENTS[N] with positional args
    let result = body.replace(
      /\$ARGUMENTS\[(\d+)\]/g,
      (_m: string, indexStr: string) => {
        const index = parseInt(indexStr, 10);
        return index < positional.length ? positional[index] : '';
      },
    );

    // Replace $N shorthand (must do after $ARGUMENTS to avoid conflicts)
    result = result.replace(/\$(\d+)(?!\d)/g, (_m: string, indexStr: string) => {
      const index = parseInt(indexStr, 10);
      return index < positional.length ? positional[index] : '';
    });

    // Replace $ARGUMENTS with full string
    result = result.replace(/\$ARGUMENTS/g, arguments_);

    // Fallback: append arguments if body had no bare $ARGUMENTS placeholder
    if (!hasBareArguments && arguments_) {
      result += `\n\nARGUMENTS: ${arguments_}`;
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Tool registration
  // ---------------------------------------------------------------------------

  getTools(): SkillToolDefinition[] {
    const prefix = this.getConfig<string>('tool_prefix', 'claude_');
    const overrides = this.getConfig<Record<string, string>>(
      'skill_descriptions',
      {},
    );
    const responsePrefix = this.getConfig<string>('response_prefix', '');
    const responsePostfix = this.getConfig<string>('response_postfix', '');
    const tools: SkillToolDefinition[] = [];

    for (const skill of this._skills) {
      // Check invocation control — skip tool registration if flagged
      if (skill._skipTool) {
        log.debug(
          `claude_skills: skipping tool registration for '${skill.name}' (invocation control)`,
        );
        continue;
      }

      const toolName = `${prefix}${this._sanitizeToolName(skill.name)}`;

      // Get description (with override support)
      const description =
        overrides[skill.name] ??
        skill.description ??
        `Use the ${skill.name} skill`;

      // Build parameters
      const parameters: Record<string, unknown> = {
        arguments: {
          type: 'string',
          description:
            skill.argumentHint || 'Arguments or context to pass to the skill',
        },
      };

      // Add section enum if there are supporting files
      const sectionNames = Array.from(skill.sections.keys()).sort();
      if (sectionNames.length > 0) {
        parameters['section'] = {
          type: 'string',
          description: 'Which reference section to load',
          enum: sectionNames,
        };
      }

      // Create handler that captures the skill and prefix/postfix
      const handler = this._makeHandler(
        skill,
        responsePrefix,
        responsePostfix,
      );

      tools.push({
        name: toolName,
        description,
        parameters,
        handler,
      });

      const sectionInfo =
        sectionNames.length > 0
          ? ` with sections: ${JSON.stringify(sectionNames)}`
          : '';
      log.debug(`claude_skills: registered tool '${toolName}'${sectionInfo}`);
    }

    return tools;
  }

  private _makeHandler(
    skill: ParsedSkill,
    responsePrefix: string,
    responsePostfix: string,
  ): (
    args: Record<string, unknown>,
    rawData: Record<string, unknown>,
  ) => FunctionResult {
    return (
      args: Record<string, unknown>,
      rawData: Record<string, unknown>,
    ): FunctionResult => {
      const section = args['section'] as string | undefined;
      const arguments_ = (args['arguments'] as string) ?? '';

      let content: string;

      if (section && skill.sections.has(section)) {
        // Load the requested section file
        try {
          content = readFileSync(skill.sections.get(section)!, 'utf-8');
        } catch (err) {
          log.error(
            `claude_skills: failed to read section '${section}': ${err instanceof Error ? err.message : String(err)}`,
          );
          content = `Error loading section '${section}'`;
        }
      } else {
        // No section specified or invalid — return SKILL.md body
        content = skill.body;
      }

      const skillDir = skill.skillDir || '.';

      // 1. Shell injection (if enabled)
      if (this._allowShellInjection) {
        content = this._executeShellInjection(
          content,
          skillDir,
          this._shellTimeout,
        );
      }

      // 2. Variable substitution
      content = this._substituteVariables(content, skillDir, rawData);

      // 3. Argument substitution (with fallback append)
      content = this._substituteArguments(content, arguments_);

      // 4. Prefix/postfix wrapping
      if (responsePrefix || responsePostfix) {
        const parts: string[] = [];
        if (responsePrefix) parts.push(responsePrefix);
        parts.push(content);
        if (responsePostfix) parts.push(responsePostfix);
        content = parts.join('\n\n');
      }

      return new FunctionResult(content);
    };
  }

  // ---------------------------------------------------------------------------
  // Prompts & hints
  // ---------------------------------------------------------------------------

  override getHints(): string[] {
    const hints: string[] = [];
    for (const skill of this._skills) {
      const name = skill.name || '';
      hints.push(
        ...name
          .replace(/-/g, ' ')
          .replace(/_/g, ' ')
          .split(/\s+/)
          .filter((w) => w.length > 0),
      );
    }
    // Deduplicate
    return [...new Set(hints)];
  }

  protected override _getPromptSections(): SkillPromptSection[] {
    if (this._skills.length === 0) return [];

    const prefix = this.getConfig<string>('tool_prefix', 'claude_');
    const sections: SkillPromptSection[] = [];

    for (const skill of this._skills) {
      // Skip skills marked to exclude from prompt
      if (skill._skipPrompt) continue;

      const toolName = `${prefix}${this._sanitizeToolName(skill.name)}`;
      const hasTool = !skill._skipTool;

      // Start with the SKILL.md body
      let body = skill.body;

      // Append available sections if any
      if (skill.sections.size > 0 && hasTool) {
        const sectionList = Array.from(skill.sections.keys()).sort().join(', ');
        body += `\n\nAvailable reference sections: ${sectionList}`;
        body += `\nCall ${toolName}(section="<name>") to load a section.`;
      }

      // Append discovered files if script execution is enabled
      if (this._allowScriptExecution) {
        for (const category of ['scripts', 'assets', 'other'] as const) {
          const fileList = skill.files[category] ?? [];
          if (fileList.length > 0) {
            const label =
              category !== 'other'
                ? category.charAt(0).toUpperCase() + category.slice(1)
                : 'Other files';
            body += `\n\n${label}: ${fileList.join(', ')}`;
          }
        }
      }

      sections.push({
        title: skill.name,
        body,
      });
    }

    return sections;
  }

  // ---------------------------------------------------------------------------
  // Instance key
  // ---------------------------------------------------------------------------

  override getInstanceKey(): string {
    const skillsPath = this.getConfig<string>('skills_path', 'default');
    // Use a simple hash for the key
    let hash = 0;
    for (let i = 0; i < skillsPath.length; i++) {
      const ch = skillsPath.charCodeAt(i);
      hash = ((hash << 5) - hash + ch) | 0;
    }
    return `claude_skills_${Math.abs(hash) % 10000}`;
  }
}

/**
 * Factory function for creating ClaudeSkillsSkill instances.
 * @param config - Optional skill configuration.
 * @returns A new ClaudeSkillsSkill instance.
 */
export function createSkill(config?: SkillConfig): ClaudeSkillsSkill {
  return new ClaudeSkillsSkill(config);
}
