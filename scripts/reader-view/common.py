"""Read and validate the reviewed Reader view layouts."""

import json
import zlib
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent


def read_assignment(path):
    body = path.read_text(encoding="utf-8")
    return json.loads(body[body.index("=") + 1:].strip().removesuffix(";"))


def read_index(repo, issue):
    body = (repo / f"assets/data/search/text/{issue}.js").read_text(encoding="utf-8")
    value = json.loads(body[body.index(",") + 1:body.rfind(")")])
    return {row[0]: row[2] for row in value["pages"]}


def units(text):
    """Use the same string positions as JavaScript's slice()."""
    raw = text.encode("utf-16-le")
    return [raw[i:i + 2] for i in range(0, len(raw), 2)]


def from_units(value):
    return b"".join(value).decode("utf-16-le")


def slice_text(text, start, end):
    return from_units(units(text)[start:end])


def part_text(part, pages):
    value = units(pages[part["index"]])[part["start"]:part["end"]]
    for start, end, replacement in reversed(part.get("patches", [])):
        value[start:end] = units(replacement)
    if part.get("dropEnd"):
        value = value[:-part["dropEnd"]]
    return from_units(value)


def walk(value):
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from walk(child)
    elif isinstance(value, list):
        for child in value:
            yield from walk(child)


def validate(config, repo):
    n = config["issue"]
    issue = read_assignment(repo / f"issues/{n}/data.js")
    refs = {page["ref"] for page in issue["pages"]}
    pages = read_index(repo, n)
    ids, occupied = set(), set()
    for article in config["articles"]:
        label = f"Issue {n}, article {article['id']}"
        def require(condition, reason):
            if not condition:
                raise ValueError(f"{label}: {reason}")
        require(article["id"] not in ids, "duplicate article id")
        ids.add(article["id"])
        require(article["format"] in {"native", "interactive", "indexed", "mank"}, "unknown article format")
        require(article["startRef"] in refs, "unknown start page")
        require(article["indices"], "no source pages")
        for index in article["indices"]:
            require(isinstance(index, int) and 0 <= index < len(issue["pages"]), "invalid page index")
            require(index not in occupied, "page assigned to more than one article")
            occupied.add(index)
        if "gallery" in article:
            require(0 <= article["gallery"] < len(issue["pages"]), "invalid gallery page")
        for ref, expected in article.get("indexCrc", {}).items():
            require(ref in pages, f"missing index page {ref}")
            require(zlib.crc32(pages[ref].encode("utf-8")) == expected, f"index text changed on page {ref}")
        for item in walk(article):
            if "index" in item and {"start", "end"} <= item.keys():
                ref = item["index"]
                require(ref in pages, f"missing index page {ref}")
                require(0 <= item["start"] <= item["end"] <= len(units(pages[ref])), f"invalid text slice on page {ref}")
                if "crc" in item:
                    require(zlib.crc32(pages[ref].encode("utf-8")) == item["crc"], f"index text changed on page {ref}")
                previous = 0
                length = item["end"] - item["start"]
                for start, end, replacement in item.get("patches", []):
                    require(previous <= start <= end <= length, f"overlapping or invalid correction on page {ref}")
                    require(isinstance(replacement, str), "correction must be text")
                    previous = end
                if "dropEnd" in item:
                    require(isinstance(item["dropEnd"], int) and item["dropEnd"] >= 0, "invalid trailing-text trim")
                part_text(item, pages)
            if "url" in item and isinstance(item.get("size"), list):
                require(item["url"].startswith("https://"), "image URL must use HTTPS")
                require(len(item["size"]) == 2 and all(v > 0 for v in item["size"]), "invalid image dimensions")
            if "source" in item:
                require(item["source"].startswith("https://"), "article source must use HTTPS")
                require(item.get("sourceBytes", 0) > 0 and isinstance(item.get("sourceCrc"), int), "source fingerprint missing")
    return len(ids)


def load_layouts(folder):
    layouts = []
    for path in sorted(folder.glob("*.json"), key=lambda p: int(p.stem)):
        value = json.loads(path.read_text(encoding="utf-8"))
        if value["issue"] != int(path.stem):
            raise ValueError(f"Issue number does not match {path.name}")
        layouts.append((path, value))
    if [value["issue"] for _, value in layouts] != list(range(1, 173)):
        raise ValueError("The layout folder must contain issues 1 through 172")
    return layouts


def compiled(config):
    return "window.CINEFEX_READING=" + json.dumps(config, ensure_ascii=False, separators=(",", ":")) + ";\n"
