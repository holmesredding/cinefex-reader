# Cinefex Reader

I put this together to make the Cinefex archive easier to read and browse. It covers all 172 issues, with an index of films, TV series and features that links directly to the articles.

The galleries and video clips are available alongside the pages. You can bookmark pages, mark issues as read, and return to where you stopped reading. There’s also a dark mode that leaves the photographs in their original colours.

The magazine files come from [Internet Archive](https://archive.org/details/cinefex-index). If you have a local copy, you can use that instead.

— [Emmett](https://www.emmettredding.com)

## Getting started

Open `index.html` in your browser. Images, videos and fonts will load from Internet Archive, which can sometimes be slow.

Your reading position, bookmarks and read status are saved in that browser.

## Using local files

Open **Information → Choose folder** and select the folder containing your issue ZIPs or extracted files. You can also select the complete Cinefex Web Archive folder if you have it. The reader checks for matching files and loads anything missing from Internet Archive.

Chrome and Edge can remember your folder. Safari keeps it selected while you move between issues in the same tab, but you’ll need to select it again after reloading or closing the tab.

A few repaired images in issues 11–16 need the complete local Web Archive; they aren’t available in the original Internet Archive downloads.

## Hosting

You can host the reader as a static website. There’s nothing to build: upload this folder’s contents and keep the directory structure intact.

For GitHub Pages, go to **Settings → Pages**, choose **Deploy from a branch**, and select **main** and **/ (root)**. Leave the `.nojekyll` file in place.

## Repository contents

This repository contains the reader, the catalogue and the magazine’s original HTML/CSS layouts. It doesn’t include the magazine images, videos, fonts or PDFs.

Run `python3 verify-package.py` to check the package for missing file references and bundled media. Browser check results are in `VERIFICATION.json`.
