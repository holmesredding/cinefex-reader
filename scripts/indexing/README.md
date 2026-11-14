# Extra indexing for Browse

`assets/data/index-extra.js` (generated) adds four things to the Browse page. The reader works the same without it.

- **Title fixes.** Remakes get their year, e.g. *Godzilla (1998)* and *Godzilla (2014)*, which were previously
  one card. HBO's *Watchmen* is filed as TV, and shortened or mistyped titles get their full form.
  Fixes are keyed by `TITLES` id, so `titles-data.js` is untouched.
- **Related titles.** These are franchises, and directors or makers with several entries: Star Wars, Star Trek,
  Alien & Predator, MCU, Middle-earth, Zemeckis, Cameron, Harryhausen and so on. Each card shows "Related: …",
  and `titles.html?franchise=Star%20Trek` lists everything in one place, across films, TV and features.
- **Ads.** These are every advertisement in the run, by advertiser, with a category filter and year spans.
  - Issues 127–172: from the ad image names and the ad's own links.
  - Issues 50–126: from each issue's printed *Advertiser Index*, read by OCR and matched to page refs.
    In two issues the printed numbers are shifted from the page refs, so they are offset.
  - Issues 1–49, and pages that no index covers: from text recognised on the ad page.
  - What's left is listed as *Unidentified advertiser*, so it can still be browsed.
- **Companies.** These are the effects companies each article discusses (two or more mentions), from page text.

## Files
| file | what |
|---|---|
| `build-index.py` | writes `assets/data/index-extra.js` and `index-related.js` from everything below |
| `index_curation.py` | title fixes and franchise lists (hand-edited) |
| `advertisers.py` | canonical advertiser names, aliases, domains, categories (hand-edited) |
| `ads_interactive.py`, `ads_archive.py` | the two ad extractors |
| `companies.py` | companies per article, from `data/page-text/` |
| `build-search.py` | writes `assets/data/search/` (word index + page text) for the Search page |
| `ocr-pages.swift` | OCR of every page with Apple Vision → `data/page-text/<issue>.json` |
| `data/advertiser-index.json` | the printed advertiser indexes, parsed (issues 50–126) |
| `data/archive-ad-text.json` | OCR text of archive ad pages |
| `data/index-offsets.json` | issues whose printed page numbers are shifted from the page refs |

## Rebuilding
```sh
python3 scripts/indexing/build-index.py              # after editing the curation or advertiser lists
swift scripts/indexing/ocr-pages.swift . "<folder with issues/N/assets/…>"   # once, on a Mac with the issue files
python3 scripts/indexing/companies.py && python3 scripts/indexing/build-index.py && python3 scripts/indexing/build-search.py
```
