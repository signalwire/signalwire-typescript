/**
 * Pagination utilities for REST API responses.
 *
 * Supports both relay REST (links.next) and LAML (next_page_uri) pagination styles.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { HttpClient } from './HttpClient.js';
import type { QueryParams } from './types.js';

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

  while (currentPath) {
    const resp = await http.get<any>(currentPath, currentParams);

    // Extract items from the response using the data key
    const items: T[] = resp[dataKey] ?? [];
    for (const item of items) {
      yield item;
    }

    // Determine next page URL
    // Style 1: links.next (relay REST)
    if (resp.links?.next) {
      const nextUrl = resp.links.next as string;
      // If it's a full URL, extract path + query
      if (nextUrl.startsWith('http')) {
        const parsed = new URL(nextUrl);
        currentPath = parsed.pathname + parsed.search;
      } else {
        currentPath = nextUrl;
      }
      currentParams = undefined; // params are in the URL already
      continue;
    }

    // Style 2: next_page_uri (LAML/compat)
    if (resp.next_page_uri) {
      currentPath = resp.next_page_uri as string;
      currentParams = undefined;
      continue;
    }

    // No more pages
    currentPath = null;
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
