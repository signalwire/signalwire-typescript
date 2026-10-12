"""Regenerate robots_oracle.json: urllib.robotparser's answers for the cases
tests/RobotsTxt.test.ts checks _RobotsRules against.

    python3 tests/fixtures/robots_oracle.py > tests/fixtures/robots_oracle.json
"""

import json
import sys
import urllib.robotparser

ROBOTS = {
    "star": "User-agent: *\nDisallow: /private\n",
    "specific": "User-agent: Spider\nDisallow: /nospider\n\nUser-agent: *\nDisallow: /\n",
    "allow_first": "User-agent: *\nAllow: /private/ok\nDisallow: /private\n",
    "disallow_first": "User-agent: *\nDisallow: /private\nAllow: /private/ok\n",
    "empty_disallow": "User-agent: *\nDisallow:\n",
    "comments": "# hello\nUser-agent: * # everyone\nDisallow: /a # no a\n",
    "orphan_agent": "User-agent: Spider\n\nUser-agent: *\nDisallow: /x\n",
    "multi_agent": "User-agent: other\nUser-agent: spider\nDisallow: /m\n",
    "encoded": "User-agent: *\nDisallow: /caf%C3%A9\nDisallow: /q?x=1\n",
    "invalid_utf8": "User-agent: *\nDisallow: /caf%E9\n",
    "crawl_delay_group": "User-agent: *\nCrawl-delay: 5\nUser-agent: spider\nDisallow: /cd\n",
    "no_groups": "Disallow: /nothing\n",
    "crlf": "User-agent: *\r\nDisallow: /private\r\n",
}
URLS = [
    "http://h/", "http://h/private", "http://h/private/ok", "http://h/private/other",
    "http://h/public", "http://h/nospider/x", "http://h/a", "http://h/x", "http://h/m",
    "http://h/café", "http://h/caf%C3%A9/z", "http://h/caf%E9", "http://h/caf%EF%BF%BD",
    "http://h/q?x=1", "http://h/q?x=2", "http://h/cd", "http://h/nothing", "http://h",
]
AGENTS = ["Spider/1.0 (SignalWire AI Agent)", "Other/2.0"]

cases = []
for name, text in ROBOTS.items():
    parser = urllib.robotparser.RobotFileParser()
    parser.parse(text.splitlines())
    for agent in AGENTS:
        for url in URLS:
            cases.append([name, agent, url, parser.can_fetch(agent, url)])
json.dump(
    {
        "_generated_by": f"tests/fixtures/robots_oracle.py, Python {sys.version.split()[0]}",
        "robots": ROBOTS,
        "cases": cases,
    },
    sys.stdout,
    indent=1,
)
