#!/usr/bin/env python3
"""
Reference implementation of the HTML → text pipeline from the Python SDK
(signalwire-python/skills/web_search/skill.py:204-282, `extract_html_content`
minus the HTTP fetch step). Also emits the text_length and sentence_count
sub-metrics used in `_calculate_content_quality` (skill.py:301, 339-342).

Used to regenerate tests/fixtures/scrape-parity/expected/*.json when either
the Python SDK or this fixture suite changes. See README.md in this folder.

Requires: beautifulsoup4 (pip install beautifulsoup4).

Usage:
    python3 python_extract.py path/to/fixture.html > expected.json
"""
import json
import re
import sys
from bs4 import BeautifulSoup


def extract(html: str) -> dict:
    soup = BeautifulSoup(html, "html.parser")

    # Selector priority — skill.py:220-228
    content_selectors = [
        "article",
        "main",
        '[role="main"]',
        ".content",
        "#content",
        ".post",
        ".entry-content",
        ".article-body",
        ".story-body",
        ".markdown-body",
        ".wiki-body",
        ".documentation",
    ]
    main_content = None
    for selector in content_selectors:
        main_content = soup.select_one(selector)
        if main_content:
            break
    if not main_content:
        main_content = soup.find("body") or soup

    content_soup = BeautifulSoup(str(main_content), "html.parser")

    # Unwanted tags — skill.py:239
    for tag in [
        "script",
        "style",
        "nav",
        "footer",
        "header",
        "aside",
        "noscript",
        "iframe",
    ]:
        for element in content_soup(tag):
            element.decompose()

    # Unwanted patterns — skill.py:245-257
    for pattern in [
        "sidebar",
        "navigation",
        "menu",
        "advertisement",
        "ads",
        "banner",
        "popup",
        "modal",
        "cookie",
        "gdpr",
        "subscribe",
        "newsletter",
        "comments",
        "related",
        "share",
        "social",
    ]:
        for element in content_soup.find_all(class_=re.compile(pattern, re.I)):
            element.decompose()
        for element in content_soup.find_all(id=re.compile(pattern, re.I)):
            element.decompose()

    # Text extraction & whitespace normalization — skill.py:260-269
    text = content_soup.get_text()
    lines = [line.strip() for line in text.splitlines()]
    lines = [line for line in lines if line]
    text = " ".join(lines)
    text = re.sub(r"\s+", " ", text).strip()

    # Sub-metrics — skill.py:301 (text_length), skill.py:339-342 (sentence_count)
    sentences = re.split(r"[.!?]+", text)
    sentence_count = len([s for s in sentences if len(s.strip()) > 30])

    return {
        "text": text,
        "text_length": len(text),
        "sentence_count": sentence_count,
    }


if __name__ == "__main__":
    html = open(sys.argv[1], encoding="utf-8").read()
    json.dump(extract(html), sys.stdout, ensure_ascii=False, indent=2)
    sys.stdout.write("\n")
