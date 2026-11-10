#!/usr/bin/env python3
"""Checks that apps/web/messages/{en,id,ru}.json carry exactly the same keys.

A missing key does not fail the build in next-intl: it renders the key path on the page instead, in the
middle of a sentence, and usually only in the language nobody on the team reads. So it is checked here.
English is the reference, because that is the source language the other two are translated from.

Run: python3 scripts/check-messages.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

MESSAGES = Path(__file__).resolve().parent.parent / "apps" / "web" / "messages"
REFERENCE = "en"
LOCALES = ("en", "id", "ru")


def flatten(node: object, prefix: str = "") -> set[str]:
    """Every leaf of the message tree as a dotted path ("Navbar.accountMenu")."""
    if not isinstance(node, dict):
        return {prefix.rstrip(".")}
    keys: set[str] = set()
    for key, value in node.items():
        keys |= flatten(value, f"{prefix}{key}.")
    return keys


def main() -> int:
    try:
        keys = {locale: flatten(json.loads((MESSAGES / f"{locale}.json").read_text("utf-8"))) for locale in LOCALES}
    except FileNotFoundError as missing:
        print(f"Message file not found: {missing.filename}", file=sys.stderr)
        return 2
    except json.JSONDecodeError as broken:
        print(f"{broken.doc and ''}Invalid JSON in a message file: {broken}", file=sys.stderr)
        return 2

    problems = False
    for locale in LOCALES:
        if locale == REFERENCE:
            continue
        missing = sorted(keys[REFERENCE] - keys[locale])
        extra = sorted(keys[locale] - keys[REFERENCE])
        if missing:
            problems = True
            print(f"{locale}.json is missing {len(missing)} key(s) that {REFERENCE}.json has:", file=sys.stderr)
            for key in missing:
                print(f"  - {key}", file=sys.stderr)
        if extra:
            problems = True
            print(f"{locale}.json has {len(extra)} key(s) that {REFERENCE}.json does not:", file=sys.stderr)
            for key in extra:
                print(f"  + {key}", file=sys.stderr)

    if problems:
        return 1
    print(f"Messages are in sync: {len(keys[REFERENCE])} keys in {', '.join(LOCALES)}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
