/**
 * Built-in skill names as a typed, compile-time-checked closed set.
 *
 * The 19 names below are exactly the `SKILL_NAME` declared by each built-in
 * skill class in `src/skills/builtin/` (the same set
 * {@link registerBuiltinSkills} locks into the global `SkillRegistry`).
 *
 * {@link AgentBase.addSkillByName} and {@link AgentBase.hasSkill} accept this
 * union OR any string (`SkillName | (string & {})`):
 *
 *   - The union gives editor autocompletion for the built-in names.
 *   - The `string & {}` arm accepts any other string, so custom / third-party
 *     skill names work, as with the Python SDK (whose `add_skill` /
 *     `has_skill` take a bare `str`). It also means a typo in a call
 *     (`addSkillByName('datetiem')`) still compiles: `addSkillByName` then
 *     rejects at runtime because the name isn't registered. To have the
 *     compiler check a built-in name, type the value as `SkillName`.
 *
 * TypeScript erases these types, so the value passed at runtime is the same
 * string either way.
 *
 * @example
 * ```ts
 * import { AgentBase, type SkillName } from '@signalwire/sdk';
 * const agent = new AgentBase({ name: 'demo', route: '/' });
 * await agent.addSkillByName('datetime');      // autocompleted built-in
 * agent.hasSkill('datetime');                  // true
 * const name: SkillName = 'math';              // checked: 'mathh' is a compile error
 * await agent.addSkillByName(name);
 * // await agent.addSkillByName('datetiem');   // compiles, rejects: not registered
 * ```
 */
export type SkillName =
  | 'api_ninjas_trivia'
  | 'ask_claude'
  | 'claude_skills'
  | 'custom_skills'
  | 'datasphere'
  | 'datasphere_serverless'
  | 'datetime'
  | 'google_maps'
  | 'info_gatherer'
  | 'joke'
  | 'math'
  | 'mcp_gateway'
  | 'native_vector_search'
  | 'play_background_file'
  | 'spider'
  | 'swml_transfer'
  | 'weather_api'
  | 'web_search'
  | 'wikipedia_search';

/**
 * A skill-name parameter: one of the typed built-in {@link SkillName} values
 * (autocompleted) or any other string (custom / third-party skills, and
 * consistency with Python's bare `str`). Because any string is accepted, a
 * misspelled built-in name isn't a compile error here.
 *
 * The `(string & {})` arm preserves string literal autocompletion for the
 * union members while still widening to accept arbitrary strings; it is purely
 * a type-level annotation and has no runtime effect.
 */
export type SkillNameOrString = SkillName | (string & {});
