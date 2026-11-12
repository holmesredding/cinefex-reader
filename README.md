# Cinefex Reader

I put this together to make the Cinefex archive easier to read and browse. It covers all 172 issues, with an index of films, TV series and features that links directly to the articles.

The galleries and video clips are available alongside the pages. You can bookmark pages, mark issues as read, and return to where you stopped reading. There’s also a dark mode that leaves the photographs in their original colours.

The magazine files come from [Internet Archive](https://archive.org/details/cinefex-index). If you have a local copy, you can use that instead.

— [Emmett](https://www.emmettredding.com)

## Getting started

[Open Cinefex Reader](https://holmesredding.github.io/cinefex-reader/). Images, videos and fonts load from Internet Archive, which can sometimes be slow.

Your reading position, bookmarks and read status are saved in that browser.

## Using local files

To keep the magazine files together on your computer:

1. Download the issue files from [Internet Archive](https://archive.org/details/cinefex-index) and the [repair ZIP for issues 11–16](https://archive.org/download/cinefex-reader-repairs-011-016/Cinefex%20Reader%20Repairs%20011-016.zip).
2. Put them in one folder, like this:

   ```text
   Cinefex files/
     Original issues/
       …issue ZIPs or extracted issue folders…
     Cinefex Reader Repairs 011-016.zip
   ```

3. In the reader, click **ⓘ → Choose folder** and select **Cinefex files**. Wait for the file check to finish.

The reader searches subfolders and recognises matching originals and repairs automatically. Individual issue ZIPs and the repair ZIP can stay zipped. If a download is an outer ZIP containing more ZIPs, extract that outer ZIP first. Already-extracted issue folders work too; keep their contents together.

For a fully local setup, also [download the reader](https://github.com/holmesredding/cinefex-reader/archive/refs/heads/main.zip), extract it into the same folder and open its `index.html`. Select **Cinefex files** as above. With all the issue files and repairs present, the reader can load the magazine material locally. Anything missing will still be requested from Internet Archive.

Chrome and Edge can remember your folder. Safari keeps it selected while you move between issues in the same tab; select it again after reloading or closing the tab.

## Hosting

You can host the reader as a static website. There’s nothing to build: upload this folder’s contents and keep the directory structure intact.

For GitHub Pages, go to **Settings → Pages**, choose **Deploy from a branch**, and select **main** and **/ (root)**. Leave the `.nojekyll` file in place.

## Repository contents

The reader, catalogue and original magazine HTML/CSS layouts are stored here. Images, videos and fonts are loaded from Internet Archive or your selected folder.

Run `python3 verify-package.py` to check the package for missing file references and bundled media. Browser check results are in `VERIFICATION.json`.
