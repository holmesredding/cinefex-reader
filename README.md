# Cinefex Reader

I put this together to make the Cinefex archive easier to read and browse. It covers all 172 issues, with an index of films, TV series and features that links directly to the articles.

The galleries and video clips are available alongside the pages. You can bookmark pages, mark issues as read, and return to where you stopped reading. There’s also a dark mode that leaves the photographs in their original colours.

The magazine files come from [Internet Archive](https://archive.org/details/cinefex-index). If you have a local copy, you can use that instead.

[Emmett](https://www.emmettredding.com)

## Getting started

[Open Cinefex Reader](https://holmesredding.github.io/cinefex-reader/). Images, videos and fonts load from Internet Archive, which can sometimes be slow.

Your reading position, bookmarks and read status are saved in that browser.

On a phone or tablet, swipe or tap the left and right edges to turn pages. Pinch to zoom the magazine page, then drag to move around it. The zoom control in the toolbar also has preset sizes and a slider. Choose **Fit** to return to the whole page and swipe between pages again. With a mouse, click and drag the page to move around while zoomed in.

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

The reader searches subfolders and recognises matching originals and repairs automatically. Individual issue ZIPs and the repair ZIP can stay zipped. If a download is an outer ZIP containing more ZIPs, extract that outer ZIP first. Already-extracted issue folders work too. Keep their contents together.

For a fully local setup, also [download the reader](https://github.com/holmesredding/cinefex-reader/archive/refs/heads/main.zip), extract it into the same folder and open its `index.html`. Select **Cinefex files** as above. With all the issue files and repairs present, the reader can load the magazine material locally. Anything missing will still be requested from Internet Archive.

Chrome and Edge can remember your folder. Safari keeps it selected while you move between issues in the same tab. Select it again after reloading or closing the tab.

## Saving PDFs

Open an issue and choose **Contents → Create PDF**. **Archive.org** is selected by default. Choose **Local folder** to use your downloaded files. Click **Create PDF**, then **Save PDF** when it is ready.

Archive.org can be very slow. Keep the tab open while it downloads. Failed downloads are retried automatically. If you cancel or a download fails, choose **Resume PDF** to reuse the images already downloaded. They are kept while you stay on that issue and are cleared when you leave it or reload.

To save the catalogue, open **Information → Save as PDFs** and choose **Archive.org** or **Local folder**. A complete set is roughly **8.9 GB** at the original image resolution.

With **Archive.org**, click **Build all PDFs**. The reader downloads and builds one issue at a time, including the repair files for issues 11–16. Downloading the whole catalogue can take a very long time. Progress shows the current issue, images downloaded and completed PDFs.

With **Local folder**, choose your downloaded files and click **Check files** first. This shows which issues are complete. Issues 11–16 also need the repair files linked above. If some issues are incomplete, you can build the available ones or add the missing files and check again.

Chrome and Edge can save each PDF into a new **Cinefex PDFs** folder inside the folder you choose. Safari builds one ZIP containing the PDFs. The estimated ZIP file size is shown before you build it. Click **Save ZIP**, wait for the download to finish, then click **Done** to clear the temporary export.

Keep the page open while it works. **Pause** stops the export and **Resume export** picks up where it left off, keeping completed PDFs and images already downloaded for the current issue. If a download still fails after automatic retries, you can resume the same way. Closing the information panel pauses the export too. **End export** clears the unfinished ZIP and downloaded images. Complete PDFs already saved to your output folder remain there. Leaving or reloading the page ends the export.

Issues 1–126 are faithful reproductions of the printed issues, preserving their original page layouts. Issues 127–172 use the expanded iPad editions, so they are less faithful to the printed issues. Gallery images are arranged together with a shared caption. Larger galleries continue onto a second page, with the caption on the first. Captions keep their original lettering. The layout and page count differ from print, and video buttons link back to the reader.

Missing local files stop a local export. You can add the files or switch to Archive.org. The catalogue export lists incomplete issues and skips them. The PDFs keep the original colours and image resolution. Article text remains part of the page images, so it is not searchable.

## Hosting

You can host the reader as a static website. There’s nothing to build: upload this folder’s contents and keep the directory structure intact.

For GitHub Pages, go to **Settings → Pages**, choose **Deploy from a branch**, and select **main** and **/ (root)**. Leave the `.nojekyll` file in place.

## Repository contents

The reader, catalogue and original magazine HTML/CSS layouts are stored here. Images, videos and fonts are loaded from Internet Archive or your selected folder.

Run `python3 verify-package.py` to check the package for missing file references and bundled media. Browser check results are in `VERIFICATION.json`.

## PDF export development

`build-pdf-layouts.py` rebuilds the export layouts for issues 1–126. Run `python3 build-pdf-layouts.py --check` to check that they still match the reader pages. The later issues have measured layouts in their `pdf-pages.js` files, including every gallery state. `build-gallery-layouts.py` generates the grouped arrangements from extracted image layers, using Pillow and NumPy. It repositions the original caption lettering. `verify-pdf-galleries.py` checks caption coverage, image placement and page mappings against those local files. Both scripts accept paths through their command-line options. `pdf-catalog.js` holds the resulting page counts and size estimates for the collection. PDF export uses the bundled pdf-lib 1.17.1 library. Its MIT licence is in `vendor/pdf-lib-LICENSE.md`.
