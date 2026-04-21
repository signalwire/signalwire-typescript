/**
 * Behavioral parity test for the web_search HTML-extraction pipeline.
 *
 * Each fixture under `tests/fixtures/scrape-parity/html/` has a matching
 * expected-output JSON under `expected/`. The expected JSON is the
 * authoritative output from the Python SDK's BeautifulSoup-based
 * `extract_html_content` (`signalwire-python/skills/web_search/skill.py`).
 *
 * We run the TS `extractTextFromHtml` helper against each fixture and
 * assert the text, codepoint length, and sentence count match Python's
 * output byte-for-byte. See `tests/fixtures/scrape-parity/README.md` for
 * regenerating the expected JSON when the Python reference changes.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { extractTextFromHtml } from '../../src/skills/builtin/web_search.js';

const here = dirname(fileURLToPath(import.meta.url));
const htmlDir = join(here, '..', 'fixtures', 'scrape-parity', 'html');
const expectedDir = join(here, '..', 'fixtures', 'scrape-parity', 'expected');

interface ExpectedParityOutput {
  text: string;
  text_length: number;
  sentence_count: number;
}

const fixtures = readdirSync(htmlDir)
  .filter((f) => f.endsWith('.html'))
  .sort();

describe('WebSearchSkill.extractTextFromHtml — Python BeautifulSoup parity', () => {
  it.each(fixtures)('matches Python reference for %s', (fixtureName) => {
    const base = fixtureName.replace(/\.html$/, '');
    const html = readFileSync(join(htmlDir, fixtureName), 'utf8');
    const expected = JSON.parse(
      readFileSync(join(expectedDir, `${base}.json`), 'utf8'),
    ) as ExpectedParityOutput;

    const text = extractTextFromHtml(html);

    // `text_length` is in codepoints (matches Python's `len()`), not
    // UTF-16 code units. Use [...text].length rather than text.length.
    const codepointLength = [...text].length;

    // `sentence_count` replicates the _qualityMetrics sentence branch:
    // split on [.!?]+, keep segments whose stripped length > 30.
    const sentenceCount = text
      .split(/[.!?]+/)
      .filter((s) => s.trim().length > 30).length;

    expect(text).toBe(expected.text);
    expect(codepointLength).toBe(expected.text_length);
    expect(sentenceCount).toBe(expected.sentence_count);
  });
});
