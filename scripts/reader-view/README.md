# Reader view tools

The reviewed layouts are in `data/`, with one JSON file per issue. They contain the paragraph order, photo placement, source references and text corrections used by Reader view. The builder writes these into each issue’s `reading.js` file.

Python 3.9 or later is required. The tools use the standard library.

## Building

From the repository root:

```sh
python3 scripts/reader-view/build.py --check
python3 scripts/reader-view/build.py
```

`--check` validates the layouts and compares them with the generated reader files. It checks page references, article assignments, text positions, correction ranges and the checksums of any search text used by the articles. All layouts are checked before any files are written.

To build a separate copy:

```sh
python3 scripts/reader-view/build.py --output /tmp/cinefex-reading
```

This writes `issues/<number>/reading.js` under the output folder. It uses the repository’s existing catalogue and search text. Native article HTML and magazine images continue to load from Archive.org or the reader’s selected local folder.

## Proofreading

You can export the text fragments used by reconstructed articles for review:

```sh
python3 scripts/reader-view/proofread.py export review.json --issues 11,12,15,16
```

Each entry records its article, source page and original text. Edit the `text` value after checking the page image. Keep the other fields as they are. Leave out `--issues` to export all reconstructed articles.

Check the corrections, then apply them:

```sh
python3 scripts/reader-view/proofread.py check review.json
python3 scripts/reader-view/proofread.py apply review.json
python3 scripts/reader-view/build.py
```

The tool checks that each fragment still matches the exported version. Corrections are stored in the layout files as replacements against the source text. The search index and original magazine files stay unchanged. After rebuilding, open the affected articles and check the wording, paragraph breaks and nearby photographs.

Review files contain article text. Keep them in your working folder and delete them when you have finished with them.

## Layout formats

- `native` uses the original ReadingView HTML, with image references and any source-specific corrections.
- `interactive` assembles the original text lines into paragraphs. Its gallery entries set where photographs and captions appear.
- `indexed` takes text from the search index. Blocks describe paragraphs, headings and photographs. Each text part identifies a page and character range, with any reviewed corrections alongside it.
- `mank` retains the paragraph mapping for the first Reader view article, in issue 172.

Gallery placement and paragraph order have been reviewed against the magazine pages. Edit those choices in `data/` and rebuild. Character positions use JavaScript’s UTF-16 indexing, which the proofreading tool handles automatically.

The OCR tools are documented in [../indexing](../indexing/README.md). Running OCR again can change the page text and invalidate existing positions. Keep a copy of the reviewed layouts, update the affected mappings, then run the builder’s check before publishing.

## Checks

```sh
python3 -m unittest discover -s scripts/reader-view -p 'test_*.py'
python3 scripts/reader-view/build.py --check
```

Coverage and source checks are recorded in [docs/READER-VIEW.json](../../docs/READER-VIEW.json). Browser checks are in [docs/VERIFICATION.json](../../docs/VERIFICATION.json).
