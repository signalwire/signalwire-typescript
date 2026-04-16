import { describe, it, expect } from 'vitest';
import { PomBuilder, PomSection } from '../src/PomBuilder.js';
import { SwmlBuilder } from '../src/SwmlBuilder.js';

describe('PomSection', () => {
  it('toDict includes only non-empty fields', () => {
    const s = new PomSection({ title: 'Hello', body: 'World' });
    const d = s.toDict();
    expect(d.title).toBe('Hello');
    expect(d.body).toBe('World');
    expect(d.bullets).toBeUndefined();
    expect(d.subsections).toBeUndefined();
  });

  it('renderMarkdown produces heading + body', () => {
    const s = new PomSection({ title: 'Title', body: 'Body text' });
    const md = s.renderMarkdown();
    expect(md).toContain('## Title');
    expect(md).toContain('Body text');
  });

  it('renderMarkdown with bullets', () => {
    const s = new PomSection({ title: 'T', bullets: ['a', 'b'] });
    const md = s.renderMarkdown();
    expect(md).toContain('- a');
    expect(md).toContain('- b');
  });

  it('renderMarkdown with numbered bullets', () => {
    const s = new PomSection({ title: 'T', bullets: ['a', 'b'], numberedBullets: true });
    const md = s.renderMarkdown();
    expect(md).toContain('1. a');
    expect(md).toContain('2. b');
  });
});

describe('PomBuilder', () => {
  it('addSection and toDict', () => {
    const b = new PomBuilder()
      .addSection('Role', { body: 'You are a helper' })
      .addSection('Rules', { bullets: ['Be nice', 'Be helpful'] });

    const dict = b.toDict();
    expect(dict.length).toBe(2);
    expect(dict[0].title).toBe('Role');
    expect(dict[0].body).toBe('You are a helper');
    expect(dict[1].bullets).toEqual(['Be nice', 'Be helpful']);
  });

  it('addToSection creates section if missing', () => {
    const b = new PomBuilder().addToSection('New', { body: 'hello' });
    expect(b.hasSection('New')).toBe(true);
    expect(b.toDict()[0].body).toBe('hello');
  });

  it('addToSection appends body', () => {
    const b = new PomBuilder()
      .addSection('S', { body: 'line1' })
      .addToSection('S', { body: 'line2' });
    expect(b.getSection('S')!.body).toBe('line1\n\nline2');
  });

  it('addToSection appends bullets', () => {
    const b = new PomBuilder()
      .addSection('S', { bullets: ['a'] })
      .addToSection('S', { bullet: 'b' })
      .addToSection('S', { bullets: ['c', 'd'] });
    expect(b.getSection('S')!.bullets).toEqual(['a', 'b', 'c', 'd']);
  });

  it('addSubsection', () => {
    const b = new PomBuilder()
      .addSection('Parent')
      .addSubsection('Parent', 'Child', { body: 'child body' });

    const dict = b.toDict();
    expect(dict[0].subsections!.length).toBe(1);
    expect(dict[0].subsections![0].title).toBe('Child');
  });

  it('addSubsection auto-creates parent', () => {
    const b = new PomBuilder().addSubsection('P', 'C', { body: 'x' });
    expect(b.hasSection('P')).toBe(true);
    expect(b.toDict()[0].subsections![0].title).toBe('C');
  });

  it('hasSection / getSection / findSection', () => {
    const b = new PomBuilder()
      .addSection('Top')
      .addSubsection('Top', 'Nested', { body: 'x' });

    expect(b.hasSection('Top')).toBe(true);
    expect(b.hasSection('Missing')).toBe(false);
    expect(b.getSection('Top')).toBeDefined();
    expect(b.findSection('Nested')).toBeDefined();
    expect(b.findSection('Missing')).toBeUndefined();
  });

  it('renderMarkdown produces valid markdown', () => {
    const b = new PomBuilder()
      .addSection('Persona', { body: 'You are helpful' })
      .addSection('Rules', { bullets: ['Be nice', 'Be clear'] });

    const md = b.renderMarkdown();
    expect(md).toContain('## Persona');
    expect(md).toContain('You are helpful');
    expect(md).toContain('## Rules');
    expect(md).toContain('- Be nice');
  });

  it('addSection with subsections in options', () => {
    const b = new PomBuilder().addSection('Root', {
      body: 'root body',
      subsections: [
        { title: 'Sub1', body: 'sub1 body' },
        { title: 'Sub2', bullets: ['x'] },
      ],
    });
    const dict = b.toDict();
    expect(dict[0].subsections!.length).toBe(2);
  });
});

describe('addPomAsSubsection', () => {
  it('appends sections of another PomBuilder by target title', () => {
    const target = new PomBuilder().addSection('Parent', { body: 'parent body' });
    const other = new PomBuilder()
      .addSection('Child A', { body: 'a' })
      .addSection('Child B', { bullets: ['x', 'y'] });

    target.addPomAsSubsection('Parent', other);

    const parent = target.getSection('Parent')!;
    expect(parent.subsections.length).toBe(2);
    expect(parent.subsections[0].title).toBe('Child A');
    expect(parent.subsections[0].body).toBe('a');
    expect(parent.subsections[1].title).toBe('Child B');
    expect(parent.subsections[1].bullets).toEqual(['x', 'y']);
  });

  it('appends sections when target is a PomSection reference', () => {
    const target = new PomBuilder().addSection('Parent');
    const parent = target.getSection('Parent')!;
    const other = new PomBuilder()
      .addSection('One')
      .addSection('Two');

    target.addPomAsSubsection(parent, other);

    expect(parent.subsections.length).toBe(2);
    expect(parent.subsections[0].title).toBe('One');
    expect(parent.subsections[1].title).toBe('Two');
  });

  it('throws when target title does not match any section', () => {
    const target = new PomBuilder().addSection('Exists');
    const other = new PomBuilder().addSection('Anything');

    expect(() => target.addPomAsSubsection('Missing', other)).toThrow(
      "No section with title 'Missing' found.",
    );
  });

  it('preserves order and count of appended sections', () => {
    const target = new PomBuilder().addSection('Parent');
    const other = new PomBuilder()
      .addSection('First')
      .addSection('Second')
      .addSection('Third');

    target.addPomAsSubsection('Parent', other);

    const parent = target.getSection('Parent')!;
    expect(parent.subsections.length).toBe(3);
    expect(parent.subsections.map((s) => s.title)).toEqual(['First', 'Second', 'Third']);
  });

  it('returns this for fluent chaining', () => {
    const builder = new PomBuilder().addSection('Parent');
    const other = new PomBuilder().addSection('Child');

    const result = builder.addPomAsSubsection('Parent', other);

    expect(result).toBe(builder);
  });
});

describe('SwmlBuilder', () => {
  it('creates empty document', () => {
    const b = new SwmlBuilder();
    const doc = b.getDocument();
    expect(doc['version']).toBe('1.0.0');
    expect((doc['sections'] as Record<string, unknown[]>)['main']).toEqual([]);
  });

  it('addVerb', () => {
    const b = new SwmlBuilder();
    b.addVerb('answer', {});
    b.addVerb('ai', { prompt: { text: 'hello' } });
    const main = (b.getDocument()['sections'] as Record<string, unknown[]>)['main'];
    expect(main.length).toBe(2);
    expect(main[0]).toEqual({ answer: {} });
  });

  it('addVerbToSection creates section', () => {
    const b = new SwmlBuilder();
    b.addVerbToSection('custom', 'play', { url: 'test.mp3' });
    const sections = b.getDocument()['sections'] as Record<string, unknown[]>;
    expect(sections['custom']).toBeDefined();
    expect(sections['custom'][0]).toEqual({ play: { url: 'test.mp3' } });
  });

  it('reset clears document', () => {
    const b = new SwmlBuilder();
    b.addVerb('answer', {});
    b.reset();
    const main = (b.getDocument()['sections'] as Record<string, unknown[]>)['main'];
    expect(main).toEqual([]);
  });

  it('renderDocument returns JSON', () => {
    const b = new SwmlBuilder();
    b.addVerb('answer', {});
    const json = b.renderDocument();
    const parsed = JSON.parse(json);
    expect(parsed.version).toBe('1.0.0');
  });
});
