/**
 * AGENTS.md mirrors CLAUDE.md for coding agents that read AGENTS.md instead.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO = join(__dirname, '..');

/** The file after its title and one-paragraph introduction. */
function body(name: string): string {
  return readFileSync(join(REPO, name), 'utf8').split('\n\n').slice(2).join('\n\n');
}

describe('AGENTS.md', () => {
  it('mirrors CLAUDE.md', () => {
    expect(body('AGENTS.md'), 'AGENTS.md and CLAUDE.md differ; make the same change to both').toBe(
      body('CLAUDE.md'),
    );
  });
});
