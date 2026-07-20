/**
 * Pagination utilities for REST API responses.
 *
 * Supports both relay REST (links.next) and LAML (next_page_uri) pagination styles.
 */

import type { HttpClient } from './HttpClient.js';
import type { QueryParams } from './types.js';

/**
 * The shape pagination needs from any page response: an item array under some
 * `dataKey`, plus the two next-page styles. The item array is `unknown[]` here
 * (cast to `T[]` at the read site) and the index signature keeps it open since
 * `dataKey` is dynamic; both pagination styles are optional.
 */
interface PageEnvelope {
  links?: { next?: string };
  next_page_uri?: string | null;
  [key: string]: unknown;
}

/**
 * Async generator that yields items across paginated API responses.
 *
 * Handles both relay REST (`links.next`) and LAML (`next_page_uri`) pagination
 * styles transparently.
 *
 * @typeParam T - Element type yielded.
 * @param http - {@link HttpClient} instance used to fetch each page.
 * @param path - Initial API path (absolute URL or path relative to `http.baseUrl`).
 * @param params - Query parameters applied to the first request only.
 *   Subsequent pages use the server-supplied next-page URL unchanged.
 * @param dataKey - Key on each response containing the array of items.
 *   Defaults to `"data"`.
 * @returns An async iterable that yields one `T` per call until exhausted.
 */
export async function* paginate<T>(
  http: HttpClient,
  path: string,
  params?: QueryParams,
  dataKey = 'data',
): AsyncGenerator<T, void, undefined> {
  let currentPath: string | null = path;
  let currentParams: QueryParams | undefined = params;

  // Repeating-cursor guard: a degraded/buggy server can return the SAME next
  // cursor twice (or a cursor pointing at a page already walked). Terminating
  // only on an ABSENT next link would loop FOREVER re-fetching the same page —
  // an unbounded HTTP + memory hot-loop with credentials attached (the fleet's
  // "repeating-cursor" pagination defect). Track every next-page path already
  // followed; if the server hands back one we have seen, stop.
  const seenNext = new Set<string>();

  while (currentPath) {
    const resp: PageEnvelope = await http.get<PageEnvelope>(currentPath, currentParams);

    // Extract items from the response using the data key
    const items = (resp[dataKey] as T[] | undefined) ?? [];
    for (const item of items) {
      yield item;
    }

    // Determine next page URL
    // Style 1: links.next (relay REST)
    // Style 2: next_page_uri (LAML/compat)
    let rawNext: string | null = null;
    if (resp.links?.next) {
      rawNext = resp.links.next;
    } else if (resp.next_page_uri) {
      rawNext = resp.next_page_uri;
    }

    if (rawNext === null) {
      // No more pages
      currentPath = null;
      break;
    }

    // Normalize a full URL down to path+query so the cycle key is stable
    // regardless of whether the server echoes an absolute or relative next.
    let nextPath: string;
    if (rawNext.startsWith('http')) {
      const parsed = new URL(rawNext);
      nextPath = parsed.pathname + parsed.search;
    } else {
      nextPath = rawNext;
    }

    // Cycle guard: a next cursor we have already followed (or the page we just
    // fetched) means the server is looping — terminate instead of spinning.
    if (nextPath === currentPath || seenNext.has(nextPath)) {
      currentPath = null;
      break;
    }
    seenNext.add(nextPath);

    currentPath = nextPath;
    currentParams = undefined; // params are in the URL already
  }
}

/**
 * Collect all paginated items into an array.
 *
 * Convenience wrapper around {@link paginate} for callers who want the full
 * list. Beware: loads every page into memory — for very large result sets,
 * iterate via `paginate()` directly.
 *
 * @typeParam T - Element type collected.
 * @param http - {@link HttpClient} instance used to fetch each page.
 * @param path - Initial API path.
 * @param params - Query parameters applied to the first request.
 * @param dataKey - Key on each response containing the array of items.
 *   Defaults to `"data"`.
 * @returns A flat array of every item across all pages.
 */
export async function paginateAll<T>(
  http: HttpClient,
  path: string,
  params?: QueryParams,
  dataKey = 'data',
): Promise<T[]> {
  const items: T[] = [];
  for await (const item of paginate<T>(http, path, params, dataKey)) {
    items.push(item);
  }
  return items;
}
