#!/usr/bin/env python3
"""Export indexed article fragments for review and apply checked corrections."""

import argparse
import difflib
import hashlib
import json
import sys
from pathlib import Path
from common import HERE, REPO, from_units, load_layouts, part_text, read_index, units, validate


def fingerprint(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True).encode("utf-8")).hexdigest()


def export_review(configs, repo, issues):
    fragments = []
    for _, config in configs:
        n = config["issue"]
        if issues and n not in issues:
            continue
        pages = read_index(repo, n)
        for article in config["articles"]:
            if article["format"] != "indexed":
                continue
            for bi, block in enumerate(article["blocks"]):
                for pi, part in enumerate(block["parts"]):
                    text = part_text(part, pages)
                    fragments.append({"issue": n, "article": article["id"], "title": article["title"], "page": part["index"], "block": bi, "part": pi, "fingerprint": fingerprint(part), "original": text, "text": text})
    return {"version": 1, "fragments": fragments}


def apply_review(review, configs, repo):
    if review.get("version") != 1:
        raise ValueError("Unknown review format")
    by_issue = {config["issue"]: config for _, config in configs}
    indexes, changed, seen = {}, set(), set()
    for entry in review["fragments"]:
        if entry["text"] == entry["original"]:
            continue
        n = entry["issue"]
        key = (n, entry["article"], entry["block"], entry["part"])
        if key in seen:
            raise ValueError(f"Duplicate correction: {key}")
        seen.add(key)
        config = by_issue[n]
        article = next(a for a in config["articles"] if a["id"] == entry["article"])
        if article["format"] != "indexed":
            raise ValueError("Only indexed article fragments can be changed with this tool")
        part = article["blocks"][entry["block"]]["parts"][entry["part"]]
        if n not in indexes:
            indexes[n] = read_index(repo, n)
        pages = indexes[n]
        if part["index"] != entry["page"] or fingerprint(part) != entry["fingerprint"] or part_text(part, pages) != entry["original"]:
            raise ValueError(f"The source has changed for {key}. Export a fresh review.")
        if not isinstance(entry["text"], str):
            raise ValueError("The replacement must be text")
        raw = units(pages[part["index"]])[part["start"]:part["end"]]
        raw_text = from_units(raw)
        edits = [[len(units(raw_text[:start])), len(units(raw_text[:end])), entry["text"][lo:hi]] for tag, start, end, lo, hi in difflib.SequenceMatcher(None, raw_text, entry["text"], autojunk=False).get_opcodes() if tag != "equal"]
        part.pop("dropEnd", None)
        part.pop("patches", None)
        if edits:
            part["patches"] = edits
        if part_text(part, pages) != entry["text"]:
            raise ValueError(f"Correction did not reproduce the reviewed text for {key}")
        changed.add(n)
    for n in changed:
        validate(by_issue[n], repo)
    return changed, len(seen)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["export", "check", "apply"])
    parser.add_argument("file", type=Path, help="Review JSON file")
    parser.add_argument("--issues", help="Comma-separated issue numbers to export")
    parser.add_argument("--repo", type=Path, default=REPO)
    parser.add_argument("--data", type=Path, default=HERE / "data")
    args = parser.parse_args()
    configs = load_layouts(args.data)
    if args.command == "export":
        issues = {int(n) for n in args.issues.split(",")} if args.issues else set()
        if not issues <= set(range(1, 173)):
            raise ValueError("Issue numbers must be between 1 and 172")
        review = export_review(configs, args.repo, issues)
        args.file.write_text(json.dumps(review, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"Exported {len(review['fragments'])} text fragments to {args.file}")
        return
    review = json.loads(args.file.read_text(encoding="utf-8"))
    changed, count = apply_review(review, configs, args.repo)
    if args.command == "apply":
        for path, config in configs:
            if config["issue"] in changed:
                path.write_text(json.dumps(config, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{'Applied' if args.command == 'apply' else 'Checked'} {count} corrections in {len(changed)} issues.")
    if changed and args.command == "apply":
        print("Run build.py to update the reader files, then check the affected articles in the browser.")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, KeyError, IndexError, StopIteration, OSError) as error:
        sys.exit(str(error) or "The reviewed fragment could not be found")
