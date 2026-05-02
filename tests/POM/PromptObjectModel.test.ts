/**
 * Tests for PromptObjectModel — direct port of Python's
 * `signalwire.pom.pom`. Each test asserts on specific markdown / XML /
 * JSON / YAML output strings, mirroring the behavior verified in the
 * Python reference. No nullness-only / mock-the-thing-you-test patterns.
 */

import { describe, it, expect } from 'vitest';
import * as yaml from 'js-yaml';
import {
  PromptObjectModel,
  Section,
} from '../../src/POM/PromptObjectModel.js';

// ---------------------------------------------------------------------------
// Section
// ---------------------------------------------------------------------------

describe('Section.constructor', () => {
  it('default constructor produces a null-titled empty section', () => {
    const s = new Section();
    expect(s.title).toBeNull();
    expect(s.body).toBe('');
    expect(s.bullets).toEqual([]);
    expect(s.subsections).toEqual([]);
    expect(s.numbered).toBeNull();
    expect(s.numberedBullets).toBe(false);
  });

  it('keyword options are applied', () => {
    const s = new Section('T', { body: 'B', bullets: ['x'], numbered: true, numberedBullets: true });
    expect(s.title).toBe('T');
    expect(s.body).toBe('B');
    expect(s.bullets).toEqual(['x']);
    expect(s.numbered).toBe(true);
    expect(s.numberedBullets).toBe(true);
  });

  it('throws TypeError when body is not a string', () => {
    expect(() => new Section('T', { body: 123 as unknown as string })).toThrow(TypeError);
  });

  it('throws TypeError when bullets is not a list', () => {
    expect(() => new Section('T', { bullets: 'x' as unknown as string[] })).toThrow(TypeError);
  });
});

describe('Section.addBody / addBullets', () => {
  it('addBody replaces body text', () => {
    const s = new Section('T', { body: 'old' });
    s.addBody('new');
    expect(s.body).toBe('new');
  });

  it('addBody throws on non-string', () => {
    const s = new Section('T');
    expect(() => s.addBody(42 as unknown as string)).toThrow(TypeError);
  });

  it('addBullets appends, not replaces', () => {
    const s = new Section('T', { bullets: ['a'] });
    s.addBullets(['b', 'c']);
    expect(s.bullets).toEqual(['a', 'b', 'c']);
  });

  it('addBullets throws on non-array', () => {
    const s = new Section('T');
    expect(() => s.addBullets('nope' as unknown as string[])).toThrow(TypeError);
  });
});

describe('Section.addSubsection', () => {
  it('appends a subsection and returns it', () => {
    const s = new Section('Parent', { body: 'p' });
    const child = s.addSubsection('Child', { body: 'c' });
    expect(s.subsections.length).toBe(1);
    expect(s.subsections[0]).toBe(child);
    expect(child.title).toBe('Child');
    expect(child.body).toBe('c');
  });

  it('rejects null title', () => {
    const s = new Section('Parent', { body: 'p' });
    expect(() => s.addSubsection(null as unknown as string)).toThrow();
  });
});

describe('Section.toDict', () => {
  it('omits empty fields', () => {
    const s = new Section('T');
    expect(s.toDict()).toEqual({ title: 'T' });
  });

  it('emits keys in title/body/bullets/subsections/numbered/numberedBullets order', () => {
    const s = new Section('T', { body: 'B', bullets: ['x'], numbered: true, numberedBullets: true });
    s.addSubsection('Sub', { body: 'sb' });
    const keys = Object.keys(s.toDict());
    expect(keys).toEqual(['title', 'body', 'bullets', 'subsections', 'numbered', 'numberedBullets']);
  });

  it('round-trips body, bullets, subsections', () => {
    const s = new Section('T', { body: 'B', bullets: ['a', 'b'] });
    s.addSubsection('Sub', { bullets: ['x'] });
    expect(s.toDict()).toEqual({
      title: 'T',
      body: 'B',
      bullets: ['a', 'b'],
      subsections: [{ title: 'Sub', bullets: ['x'] }],
    });
  });
});

describe('Section.renderMarkdown', () => {
  it('renders title + body at level 2', () => {
    const s = new Section('T', { body: 'Hello' });
    expect(s.renderMarkdown()).toBe('## T\n\nHello\n');
  });

  it('renders bullets as dash-prefixed lines', () => {
    const s = new Section('T', { bullets: ['a', 'b'] });
    expect(s.renderMarkdown()).toBe('## T\n\n- a\n- b\n');
  });

  it('renders numbered bullets when numberedBullets=true', () => {
    const s = new Section('T', { bullets: ['a', 'b'], numberedBullets: true });
    expect(s.renderMarkdown()).toBe('## T\n\n1. a\n2. b\n');
  });

  it('respects level parameter', () => {
    const s = new Section('Deep', { body: 'x' });
    expect(s.renderMarkdown(4)).toBe('#### Deep\n\nx\n');
  });
});

describe('Section.renderXml', () => {
  it('renders title-only section with empty body section omitted', () => {
    const s = new Section('T', { body: 'B' });
    expect(s.renderXml()).toBe('<section>\n  <title>T</title>\n  <body>B</body>\n</section>');
  });

  it('emits <bullet> elements without id when not numbered', () => {
    const s = new Section('T', { bullets: ['a'] });
    expect(s.renderXml()).toContain('<bullet>a</bullet>');
    expect(s.renderXml()).not.toContain('id="');
  });

  it('emits <bullet id="N"> when numberedBullets=true', () => {
    const s = new Section('T', { bullets: ['a', 'b'], numberedBullets: true });
    expect(s.renderXml()).toContain('<bullet id="1">a</bullet>');
    expect(s.renderXml()).toContain('<bullet id="2">b</bullet>');
  });

  it('honors indent parameter for nested sections', () => {
    const s = new Section('T', { body: 'B' });
    expect(s.renderXml(1)).toBe('  <section>\n    <title>T</title>\n    <body>B</body>\n  </section>');
  });
});

// ---------------------------------------------------------------------------
// PromptObjectModel
// ---------------------------------------------------------------------------

describe('PromptObjectModel.addSection', () => {
  it('appends to sections list and returns the Section', () => {
    const pom = new PromptObjectModel();
    const s = pom.addSection('First', { body: 'f' });
    expect(pom.sections.length).toBe(1);
    expect(pom.sections[0]).toBe(s);
    expect(s.title).toBe('First');
  });

  it('allows null title only on the first section', () => {
    const pom = new PromptObjectModel();
    pom.addSection(null, { body: 'leading paragraph' });
    expect(() => pom.addSection(null, { body: 'second' })).toThrow(/Only the first section/);
  });

  it('coerces a string bullet argument to a single-element list', () => {
    const pom = new PromptObjectModel();
    const s = pom.addSection('T', { bullets: 'just one' });
    expect(s.bullets).toEqual(['just one']);
  });
});

describe('PromptObjectModel.findSection', () => {
  it('locates a top-level section by title', () => {
    const pom = new PromptObjectModel();
    pom.addSection('A', { body: 'a' });
    pom.addSection('B', { body: 'b' });
    const found = pom.findSection('B');
    expect(found?.title).toBe('B');
  });

  it('recurses into subsections', () => {
    const pom = new PromptObjectModel();
    const a = pom.addSection('A', { body: 'a' });
    const sub = a.addSubsection('Nested', { body: 'n' });
    sub.addSubsection('Deeply', { body: 'd' });
    expect(pom.findSection('Deeply')?.title).toBe('Deeply');
  });

  it('returns null when not found', () => {
    const pom = new PromptObjectModel();
    pom.addSection('Only', { body: 'o' });
    expect(pom.findSection('Missing')).toBeNull();
  });
});

describe('PromptObjectModel.toDict / toJson / toYaml', () => {
  it('toDict returns array of section dicts', () => {
    const pom = new PromptObjectModel();
    pom.addSection('A', { body: 'a' });
    pom.addSection('B', { bullets: ['x'] });
    expect(pom.toDict()).toEqual([
      { title: 'A', body: 'a' },
      { title: 'B', bullets: ['x'] },
    ]);
  });

  it('toJson is parseable JSON matching toDict()', () => {
    const pom = new PromptObjectModel();
    pom.addSection('A', { body: 'a' });
    const json = pom.toJson();
    expect(JSON.parse(json)).toEqual(pom.toDict());
  });

  it('toJson is pretty-printed with 2-space indent', () => {
    const pom = new PromptObjectModel();
    pom.addSection('A', { body: 'a' });
    expect(pom.toJson()).toContain('\n  ');
  });

  it('toYaml is parseable YAML matching toDict()', () => {
    const pom = new PromptObjectModel();
    pom.addSection('A', { body: 'a' });
    pom.addSection('B', { bullets: ['x', 'y'] });
    const parsed = yaml.load(pom.toYaml());
    expect(parsed).toEqual(pom.toDict());
  });
});

describe('PromptObjectModel.fromJson / fromYaml', () => {
  it('round-trips toJson -> fromJson', () => {
    const original = new PromptObjectModel();
    original.addSection('Role', { body: 'You are an agent' });
    original.addSection('Rules', { bullets: ['Be brief'] });
    const restored = PromptObjectModel.fromJson(original.toJson());
    expect(restored.toDict()).toEqual(original.toDict());
  });

  it('round-trips toYaml -> fromYaml', () => {
    const original = new PromptObjectModel();
    original.addSection('Role', { body: 'You are an agent' });
    original.addSection('Rules', { bullets: ['Be brief'] });
    const restored = PromptObjectModel.fromYaml(original.toYaml());
    expect(restored.toDict()).toEqual(original.toDict());
  });

  it('fromJson accepts an already-parsed array', () => {
    const data = [
      { title: 'A', body: 'a' },
      { title: 'B', bullets: ['x'] },
    ];
    const pom = PromptObjectModel.fromJson(data);
    expect(pom.sections.length).toBe(2);
    expect(pom.sections[0].title).toBe('A');
    expect(pom.sections[1].bullets).toEqual(['x']);
  });

  it('fromJson rejects sections with neither body, bullets, nor subsections', () => {
    expect(() => PromptObjectModel.fromJson([{ title: 'Empty' }])).toThrow(
      /must have either a non-empty body/,
    );
  });

  it('fromJson rejects non-string title', () => {
    expect(() => PromptObjectModel.fromJson([{ title: 42, body: 'x' }])).toThrow(/'title' must be a string/);
  });

  it('fromJson rejects non-list bullets', () => {
    expect(() => PromptObjectModel.fromJson([{ title: 'T', bullets: 'no' }])).toThrow(
      /'bullets' must be a list/,
    );
  });

  it('fromJson rejects non-array top-level data', () => {
    expect(() => PromptObjectModel.fromJson({ title: 'T', body: 'x' })).toThrow(/list of sections/);
  });

  it('fromJson injects "Untitled Section" for any non-first section missing a title', () => {
    const data = [
      { title: 'First', body: 'one' },
      { body: 'no title' },
    ];
    const pom = PromptObjectModel.fromJson(data);
    expect(pom.sections[1].title).toBe('Untitled Section');
  });

  it('fromJson recursively rebuilds subsections', () => {
    const data = [
      {
        title: 'Parent',
        body: 'p',
        subsections: [
          { title: 'Child', body: 'c' },
          { title: 'Sibling', bullets: ['x'] },
        ],
      },
    ];
    const pom = PromptObjectModel.fromJson(data);
    expect(pom.sections[0].subsections.length).toBe(2);
    expect(pom.sections[0].subsections[0].title).toBe('Child');
    expect(pom.sections[0].subsections[1].bullets).toEqual(['x']);
  });
});

describe('PromptObjectModel.renderMarkdown', () => {
  it('emits one ## heading per top-level section, separated by blank lines', () => {
    const pom = new PromptObjectModel();
    pom.addSection('Role', { body: 'agent' });
    pom.addSection('Rules', { bullets: ['Be brief'] });
    const md = pom.renderMarkdown();
    expect(md).toContain('## Role');
    expect(md).toContain('agent');
    expect(md).toContain('## Rules');
    expect(md).toContain('- Be brief');
  });

  it('numbers all sections when any one is numbered', () => {
    const pom = new PromptObjectModel();
    pom.addSection('A', { body: 'a', numbered: true });
    pom.addSection('B', { body: 'b' });
    const md = pom.renderMarkdown();
    expect(md).toContain('## 1. A');
    expect(md).toContain('## 2. B');
  });

  it('skips numbering when no section is numbered', () => {
    const pom = new PromptObjectModel();
    pom.addSection('A', { body: 'a' });
    pom.addSection('B', { body: 'b' });
    const md = pom.renderMarkdown();
    expect(md).toContain('## A');
    expect(md).not.toMatch(/## \d+\./);
  });

  it('omits numbering on a section explicitly numbered=false even when peers are numbered', () => {
    const pom = new PromptObjectModel();
    pom.addSection('A', { body: 'a', numbered: true });
    pom.addSection('B', { body: 'b', numbered: false });
    pom.addSection('C', { body: 'c', numbered: true });
    const md = pom.renderMarkdown();
    expect(md).toContain('## 1. A');
    expect(md).toContain('## B');
    expect(md.includes('## 2. B')).toBe(false);
    expect(md).toContain('## 3. C');
  });

  it('renders subsections at deeper heading levels', () => {
    const pom = new PromptObjectModel();
    const role = pom.addSection('Role', { body: 'r' });
    role.addSubsection('Voice', { body: 'v' });
    const md = pom.renderMarkdown();
    expect(md).toContain('## Role');
    expect(md).toContain('### Voice');
  });
});

describe('PromptObjectModel.renderXml', () => {
  it('wraps output in <?xml...?> + <prompt>...</prompt>', () => {
    const pom = new PromptObjectModel();
    pom.addSection('A', { body: 'a' });
    const xml = pom.renderXml();
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<prompt>\n')).toBe(true);
    expect(xml.endsWith('</prompt>')).toBe(true);
    expect(xml).toContain('<section>');
    expect(xml).toContain('<title>A</title>');
    expect(xml).toContain('<body>a</body>');
  });

  it('renders <bullets><bullet>...</bullet></bullets>', () => {
    const pom = new PromptObjectModel();
    pom.addSection('A', { bullets: ['x', 'y'] });
    const xml = pom.renderXml();
    expect(xml).toContain('<bullets>');
    expect(xml).toContain('<bullet>x</bullet>');
    expect(xml).toContain('<bullet>y</bullet>');
    expect(xml).toContain('</bullets>');
  });

  it('renders <subsections> wrapper for nested sections', () => {
    const pom = new PromptObjectModel();
    const a = pom.addSection('A', { body: 'a' });
    a.addSubsection('Sub', { body: 's' });
    const xml = pom.renderXml();
    expect(xml).toContain('<subsections>');
    expect(xml).toContain('<title>Sub</title>');
    expect(xml).toContain('</subsections>');
  });

  it('numbers titles in the same any-numbered policy as renderMarkdown', () => {
    const pom = new PromptObjectModel();
    pom.addSection('A', { body: 'a', numbered: true });
    pom.addSection('B', { body: 'b' });
    const xml = pom.renderXml();
    expect(xml).toContain('<title>1. A</title>');
    expect(xml).toContain('<title>2. B</title>');
  });
});

describe('PromptObjectModel.addPomAsSubsection', () => {
  it('appends sections of another PromptObjectModel under a target by title', () => {
    const target = new PromptObjectModel();
    target.addSection('Parent', { body: 'p' });
    const other = new PromptObjectModel();
    other.addSection('A', { body: 'a' });
    other.addSection('B', { bullets: ['x'] });

    target.addPomAsSubsection('Parent', other);

    const parent = target.findSection('Parent')!;
    expect(parent.subsections.length).toBe(2);
    expect(parent.subsections[0].title).toBe('A');
    expect(parent.subsections[1].bullets).toEqual(['x']);
  });

  it('accepts a Section reference as the target', () => {
    const target = new PromptObjectModel();
    const parent = target.addSection('Parent', { body: 'p' });
    const other = new PromptObjectModel();
    other.addSection('Solo', { body: 's' });

    target.addPomAsSubsection(parent, other);

    expect(parent.subsections.length).toBe(1);
    expect(parent.subsections[0].title).toBe('Solo');
  });

  it('throws Error when no section with the target title exists', () => {
    const target = new PromptObjectModel();
    target.addSection('Only', { body: 'o' });
    const other = new PromptObjectModel();
    other.addSection('Anything', { body: 'a' });

    expect(() => target.addPomAsSubsection('Missing', other)).toThrow(
      "No section with title 'Missing' found.",
    );
  });

  it('throws TypeError on invalid target type', () => {
    const target = new PromptObjectModel();
    const other = new PromptObjectModel();
    other.addSection('A', { body: 'a' });
    expect(() => target.addPomAsSubsection(42 as unknown as string, other)).toThrow(TypeError);
  });
});

// ---------------------------------------------------------------------------
// Integration: PomBuilder.toPromptObjectModel + AgentBase.pom
// ---------------------------------------------------------------------------

describe('PomBuilder.pom getter (Python parity)', () => {
  it('produces a PromptObjectModel that renders identical markdown', async () => {
    const { PomBuilder } = await import('../../src/PomBuilder.js');
    const builder = new PomBuilder()
      .addSection('Role', { body: 'helper' })
      .addSection('Rules', { bullets: ['Be brief', 'Be kind'] });
    const pom = builder.pom;
    expect(pom).toBeInstanceOf(PromptObjectModel);
    expect(pom.renderMarkdown()).toBe(builder.renderMarkdown());
    expect(pom.renderXml()).toBe(builder.renderXml());
  });

  it('preserves numbered/numberedBullets settings', async () => {
    const { PomBuilder } = await import('../../src/PomBuilder.js');
    const builder = new PomBuilder()
      .addSection('A', { body: 'a', numbered: true })
      .addSection('B', { bullets: ['x', 'y'], numberedBullets: true });
    const pom = builder.pom;
    expect(pom.sections[0].numbered).toBe(true);
    expect(pom.sections[1].numberedBullets).toBe(true);
    expect(pom.renderMarkdown()).toContain('## 1. A');
    expect(pom.renderMarkdown()).toContain('1. x');
  });
});

describe('AgentBase.pom getter', () => {
  it('returns a PromptObjectModel instance reflecting agent prompt sections', async () => {
    const { AgentBase } = await import('../../src/AgentBase.js');
    const agent = new AgentBase({ name: 'pom-test', route: '/pom-test', usePom: true });
    agent.promptAddSection('Role', { body: 'You are an assistant' });
    agent.promptAddSection('Rules', { bullets: ['Be honest'] });

    const pom = agent.pom;
    expect(pom).toBeInstanceOf(PromptObjectModel);
    const role = pom!.findSection('Role');
    expect(role?.body).toBe('You are an assistant');
    const md = pom!.renderMarkdown();
    expect(md).toContain('## Role');
    expect(md).toContain('You are an assistant');
    expect(md).toContain('- Be honest');
  });

  it('returns null when usePom is false', async () => {
    const { AgentBase } = await import('../../src/AgentBase.js');
    const agent = new AgentBase({ name: 'no-pom', route: '/no-pom', usePom: false });
    expect(agent.pom).toBeNull();
  });
});
