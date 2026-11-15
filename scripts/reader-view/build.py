#!/usr/bin/env python3
"""Compile reviewed layouts into each issue's reading.js file."""

import argparse
import sys
from pathlib import Path
from common import HERE, REPO, compiled, load_layouts, validate


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=Path, default=REPO)
    parser.add_argument("--data", type=Path, default=HERE / "data")
    parser.add_argument("--output", type=Path, help="Write to another directory, retaining issues/<number>/reading.js")
    parser.add_argument("--check", action="store_true", help="Validate sources and compare existing files without writing")
    args = parser.parse_args()
    layouts = load_layouts(args.data)
    count = sum(validate(config, args.repo) for _, config in layouts)
    output = args.output or args.repo
    pending = []
    for _, config in layouts:
        path = output / f"issues/{config['issue']}/reading.js"
        body = compiled(config)
        if not path.exists() or path.read_text(encoding="utf-8") != body:
            pending.append((path, body))
    if args.check and pending:
        for path, _ in pending:
            print(f"Out of date: {path}", file=sys.stderr)
        return 1
    for path, body in pending:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(body, encoding="utf-8")
    print(f"Checked {len(layouts)} issues and {count} articles. " + ("All generated files match." if args.check else f"Wrote {len(pending)} files."))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (ValueError, KeyError, OSError) as error:
        sys.exit(str(error))
