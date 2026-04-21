# Web-search scrape parity fixtures

These fixtures cross-check that the TypeScript SDK's HTML → plain-text
extraction (`extractTextFromHtml` in `src/skills/builtin/web_search.ts`)
produces byte-identical output to the Python SDK's `extract_html_content`
(`signalwire-python/skills/web_search/skill.py:204-282`).

The TypeScript side uses cheerio; the Python side uses BeautifulSoup with
the `html.parser` backend. The test at `tests/skills/web-search-parity.test.ts`
runs the TS pipeline against each `html/*.html` fixture and asserts the
result matches `expected/*.json` exactly.

## Why this is pinned, not live

The expected outputs are checked in (rather than computed by running Python
in the test). That avoids a Python runtime dependency in CI and guarantees
the test is deterministic — the Python side is effectively frozen until a
developer intentionally regenerates.

## Regenerating expected outputs

When the Python reference changes or a new fixture is added:

```bash
cd tests/fixtures/scrape-parity
pip install beautifulsoup4    # only first time

for html in html/*.html; do
  name=$(basename "$html" .html)
  python3 python_extract.py "$html" > "expected/$name.json"
done
```

Review the diff carefully before committing — any change to an expected
file is a behavioral change in the Python reference that the TS side now
needs to match.

## Fixture guide

| File | Behavior exercised |
|---|---|
| `01_simple_article.html` | Baseline — `<nav>` / `<header>` / `<footer>` stripped around a plain `<article>`. |
| `02_class_based_noise.html` | Class-based pattern filter against sidebar / advertisement / cookie / related / share wrappers. |
| `03_nested_containers.html` | `<article>` nested inside `<main>` — selector priority picks `article` first. |
| `04_bare_body.html` | No semantic containers — falls all the way through to `<body>`. |
| `05_malformed.html` | Unclosed tags — verifies parsers recover to the same DOM shape. |
| `06_multi_class.html` | Multi-class elements — tests that the regex matches on substring of the full `class` attribute. |
| `07_anchor_pattern.html` | Patterns are substring regexes with no anchors — `nav` matches both `"nav"` and `"snav"`. |
| `08_inline_script.html` | `<script>` / `<style>` content is dropped, neighboring `<p>` content preserved. |
| `09_whitespace_nbsp.html` | Runs of whitespace, `&nbsp;`, tabs and newlines collapse to single spaces. |
| `10_entity_unicode.html` | HTML entities decode; astral-plane characters (emoji, mathematical bold) count as codepoints, not UTF-16 code units. |
| `11_cdata_comments.html` | HTML comments dropped; `<![CDATA[…]]>` content preserved (matches Python `html.parser`). |
| `12_deep_nested_removals.html` | Real article nested inside a `class="also-sidebar-deep"` wrapper — selector runs BEFORE pattern removal so the article still wins. |
