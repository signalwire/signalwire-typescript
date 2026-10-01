/**
 * Knowledge base loader for the multi-agent tutorial (Lesson 2).
 *
 * Splits a Markdown knowledge base into one document per section, in the
 * shape the native_vector_search skill indexes in memory:
 * `{ id, text, metadata: { filename, section } }`.
 */

// region: loader
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

/** One searchable section of a knowledge base file. */
export interface KnowledgeDocument {
  id: string;
  text: string;
  metadata: { filename: string; section: string };
}

/**
 * Read a Markdown file and return one document per `###` section. Each
 * document starts with its `##` and `###` headings, so a result read on its
 * own still says what it's about. A heading with no text under it adds no document.
 */
export function loadKnowledge(path: string): KnowledgeDocument[] {
  const filename = basename(path);
  const docs: KnowledgeDocument[] = [];
  let chapter = '';
  let heading = '';
  let body: string[] = [];

  const flush = (): void => {
    const text = body.join('\n').trim();
    const section = heading && chapter ? `${chapter} > ${heading}` : heading || chapter;
    if (section && text) {
      docs.push({
        id: `${filename}#${docs.length + 1}`,
        text: `${section}\n${text}`,
        metadata: { filename, section },
      });
    }
    body = [];
  };

  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const match = /^(#{1,3})\s+(.*)$/.exec(line);
    if (!match) {
      body.push(line);
      continue;
    }
    flush();
    const [, hashes, title] = match;
    if (hashes !== '###') chapter = hashes === '##' ? title!.trim() : '';
    heading = hashes === '###' ? title!.trim() : '';
  }
  flush();
  return docs;
}
// endregion: loader
