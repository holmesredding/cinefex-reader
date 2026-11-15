# Cinefex Reader

I put this together to make the Cinefex archive easier to read and browse. It covers all 172 issues, with an index of films, TV series and features that links directly to the articles.

The galleries and video clips are available alongside the pages. You can bookmark pages, mark issues as read, and return to where you stopped reading. There's also dark mode, it makes the text pages dark, but leaves the photos alone. Some pages may still have white sections.

The magazine files come from [Internet Archive](https://archive.org/details/cinefex-index). If you have a local copy, you can use that instead.

[Emmett](https://www.emmettredding.com)

## Getting started

[Open Cinefex Reader](https://holmesredding.github.io/cinefex-reader/). Images, videos and fonts load from Internet Archive, which can sometimes be slow.

On iPhone or iPad, open the Share menu in Safari and choose **Add to Home Screen**. This adds **Cinefex Reader** with its own home screen icon.

Your reading position, bookmarks and read status are saved in that browser.

## Browsing and search

Choose **Small grid**, **Large grid** or **List** from the View menu on Issues and Browse. Your choice is remembered. In Browse, the letter shortcuts jump through titles when sorted A–Z.

**Search** looks through the magazine text for names, companies and other words. Put a phrase in quotes to search for those words together, or use `harryhaus*` to match the start of a word. Results are grouped by issue, with the total number of matching pages shown above them. Open an issue’s results to see the matching pages, or choose **Pages** from the View menu for a flat list.

The **Search** field on Issues and Browse searches the same magazine text. Press **Enter** or choose **Search catalogue** to open the results. Use **Filter issues**, **Filter films** or the filter for your chosen category to narrow the items on that page. Company and advertiser filters recognise names such as ILM as well as Industrial Light & Magic. Some of the text was recognised from page images, so names and spellings can be wrong.

Browse also has **Companies** and **Ads** tabs. Related-title links bring together films, series and features from the same franchise or filmmaker.

## Reading

On a computer, use the **left and right arrow keys** or **scroll over the page** to turn pages. **Space** moves forward, **Shift+Space** goes back.

On a phone or tablet, **swipe** or **tap the left and right edges** to turn pages. **Pinch** to zoom the page, then **drag** to move around it. With a mouse, **click and drag** while zoomed in. The zoom control also has preset sizes and a slider. Choose **Fit** to return to the whole page and swipe between pages again.

**Reader view** lets you change the text size and scroll through an article with its photos and captions. It is available throughout the catalogue. Click a photo to enlarge it. Comparison images stay together, and switching between **Page** and **Reader view** keeps you near the same passage.

Most articles use the original iPad text. Some earlier features use recognised text from the scans. Those have been checked and corrected, but may still contain transcription errors.

Where **Fit text** is available, it enlarges the text area while keeping the original page layout.

Choose your default in **Information → Default view**. You can still switch between **Page** and **Reader view** while reading. Covers and ads always use Page view.

Choose **Hide controls** in the top toolbar or **Contents** to fill the window with the page. Page turning, scrolling and zoom still work. Press **Escape**, use your browser’s **Back** button, or tap the middle of the page on a touch screen to bring the controls back.

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

3. In the reader, click **Information → Choose folder** and select **Cinefex files**. Wait for the file check to finish.

The reader searches subfolders and recognises matching originals and repairs automatically. Individual issue ZIPs and the repair ZIP can stay zipped. If a download is an outer ZIP containing more ZIPs, extract that outer ZIP first. Already-extracted issue folders work too. Keep their contents together.

Keep the HTML files when extracting an issue. Reader view can use the original ReadingView files from your selected folder or from inside the issue ZIPs. It loads anything missing from Archive.org.

For a fully local setup, also [download the reader](https://github.com/holmesredding/cinefex-reader/archive/refs/heads/main.zip), extract it into the same folder and open its `index.html`. Select **Cinefex files** as above. With all the issue files and repairs present, the reader can load the magazine material locally. Anything missing will still be requested from Internet Archive.

The search index is included with the reader download and works offline too.

Chrome and Edge can remember your folder. Safari keeps it selected while you move between issues in the same tab. Select it again after reloading or closing the tab.

## Saving PDFs

Open an issue and choose **Contents → Create PDF**. **Local folder** is selected if you have a folder connected, otherwise **Archive.org** is selected. You can change this before creating the PDF. Click **Create PDF**, then **Save PDF** when it is ready.

Archive.org can be very slow. Keep the tab open while it downloads. Failed downloads are retried automatically. If you cancel or a download fails, choose **Resume PDF** to reuse the images already downloaded. They are kept while you stay on that issue and are cleared when you leave it or reload.

To save the catalogue, open **Information → Save as PDFs**. This also defaults to your connected local folder, or **Archive.org** if none is connected. A complete set is roughly **8.9 GB** at the original image resolution.

With **Archive.org**, click **Build all PDFs**. The reader downloads and builds one issue at a time, including the repair files for issues 11–16. Downloading the whole catalogue can take a very long time. Progress shows the current issue, images downloaded and completed PDFs.

With **Local folder**, choose your downloaded files and click **Check files** first. This shows which issues are complete. Issues 11–16 also need the repair files linked above. If some issues are incomplete, you can build the available ones or add the missing files and check again.

Chrome and Edge can save each PDF into a new **Cinefex PDFs** folder inside the folder you choose. Safari builds one ZIP containing the PDFs. The estimated ZIP file size is shown before you build it. Click **Save ZIP**, wait for the download to finish, then click **Done** to clear the temporary export.

Keep the page open while it works. **Pause** stops the export and **Resume export** picks up where it left off, keeping completed PDFs and images already downloaded for the current issue. If a download still fails after automatic retries, you can resume the same way. Closing the information panel pauses the export too. **End export** clears the unfinished ZIP and downloaded images. Complete PDFs already saved to your output folder remain there. Leaving or reloading the page ends the export.

Issues 1–126 are faithful reproductions of the printed issues, preserving their original page layouts. Issues 127–172 use the expanded iPad editions, so they are less faithful to the printed issues. Gallery images are arranged together with a shared caption. Larger galleries continue onto a second page, with the caption on the first. Captions keep their original lettering. The layout and page count differ from print, and video buttons link back to the reader.

Missing local files stop a local export. You can add the files or switch to Archive.org. The catalogue export lists incomplete issues and skips them. The PDFs keep the original colours and image resolution. Article text remains part of the page images, so it is not searchable.

## Thanks

Thanks to [Mike Parsons](https://github.com/mikeparsonstv-rgb) for [the OCR and indexing work](https://github.com/holmesredding/cinefex-reader/pull/1). Mike added full-text search, company and advertiser browsing, related titles and title corrections.

## Hosting

You can host the reader as a static website. There’s nothing to build: upload this folder’s contents and keep the directory structure intact.

For GitHub Pages, go to **Settings → Pages**, choose **Deploy from a branch**, and select **main** and **/ (root)**. Leave the `.nojekyll` file in place.

## Repository contents

The reader, catalogue, search index and original magazine HTML/CSS layouts are stored here. The search files include recognised page text for matching phrases and showing excerpts. Magazine images, videos and fonts are loaded from Internet Archive or your selected folder.

- `assets/js/` contains the reader code and PDF tools.
- `assets/css/` contains the reader styles.
- `assets/data/` contains the catalogue, browsing indexes and searchable page text.
- `assets/icons/` contains the reader’s app icon in three sizes. File details are recorded in `docs/APP-ICON.json`.
- `assets/app.webmanifest` sets the home screen name and launch settings.
- `assets/vendor/` contains pdf-lib and its licence.
- `issues/` contains each issue’s page layouts, Reader view mappings and PDF export data.
- `scripts/` contains the build and verification tools.
- `docs/` contains the verification results.

The four HTML files at the top level open Issues, Browse, Search and the reader session.

Run `python3 scripts/verify-package.py` to check the package for missing file references and unexpected media files. Browser check results are in `docs/VERIFICATION.json`.

The indexing tools are documented in [scripts/indexing](scripts/indexing/README.md). Reader view build and proofreading tools are in [scripts/reader-view](scripts/reader-view/README.md). Coverage and source checks are recorded in [docs/READER-VIEW.json](docs/READER-VIEW.json).

## PDF export development

`scripts/build-pdf-layouts.py` rebuilds the export layouts for issues 1–126. Run `python3 scripts/build-pdf-layouts.py --check` to check that they still match the reader pages. The later issues have measured layouts in their `pdf-pages.js` files, including every gallery state. `scripts/build-gallery-layouts.py` generates the grouped arrangements from extracted image layers, using Pillow and NumPy. It repositions the original caption lettering. `scripts/verify-pdf-galleries.py` checks caption coverage, image placement and page mappings against those local files. Both scripts accept paths through their command-line options. `assets/data/pdf-catalog.js` holds the resulting page counts and size estimates for the collection. PDF export uses the bundled pdf-lib 1.17.1 library. Its MIT licence is in `assets/vendor/pdf-lib-LICENSE.md`.
