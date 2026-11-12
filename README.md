# Cinefex Reader

I put this together to make the Cinefex archive easier to read and browse. It covers all 172 issues, with an index of films, TV series and features that links directly to the articles.

The galleries and video clips are available alongside the pages. You can bookmark pages, mark issues as read, and return to where you stopped reading. There’s also a dark mode that leaves the photographs in their original colours.

The magazine files come from [Internet Archive](https://archive.org/details/cinefex-index). If you have a local copy, you can use that instead.

— [Emmett](https://www.emmettredding.com)

## Getting started

[Open Cinefex Reader](https://holmesredding.github.io/cinefex-reader/). Images, videos and fonts load from Internet Archive, which can sometimes be slow.

Your reading position, bookmarks and read status are saved in that browser.

## Using local files

If you’ve downloaded the magazine files from [Internet Archive](https://archive.org/details/cinefex-index), you can read those copies without waiting for each image to download again.

1. Put the downloaded issue ZIPs in a folder on your computer. Individual issue ZIPs can stay zipped. If your download is an outer ZIP containing more ZIPs, extract that outer ZIP first.
2. Open the reader and click the information button (ⓘ), then **Choose folder**.
3. Select the folder containing the issue ZIPs and wait for the file check to finish.

Already extracted the issue ZIPs? Select the folder containing those extracted files. Keep their subfolders together. The reader searches through them automatically and uses Internet Archive for files it can’t find locally.

Chrome and Edge can remember your folder. Safari keeps it selected while you move between issues in the same tab, but you’ll need to select it again after reloading or closing the tab.

Repaired image and text layers for issues 11–16 load automatically from a [separate repair pack](https://archive.org/details/cinefex-reader-repairs-011-016).

## Hosting

You can host the reader as a static website. There’s nothing to build: upload this folder’s contents and keep the directory structure intact.

For GitHub Pages, go to **Settings → Pages**, choose **Deploy from a branch**, and select **main** and **/ (root)**. Leave the `.nojekyll` file in place.

## Repository contents

The reader, catalogue and original magazine HTML/CSS layouts are stored here. Images, videos and fonts are loaded from Internet Archive or your selected folder.

Run `python3 verify-package.py` to check the package for missing file references and bundled media. Browser check results are in `VERIFICATION.json`.
