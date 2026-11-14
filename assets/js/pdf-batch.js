(() => {
  'use strict';
  document.addEventListener('DOMContentLoaded', () => {
    const info = document.querySelector('#readerInfo');
    if (!info) return;
    const sources = window.CinefexSources, core = window.CinefexPDF;
    const section = document.createElement('section');
    section.className = 'pdf-collection';
    section.innerHTML = `<h3>Save as PDFs</h3>
      <fieldset class="batch-source"><legend>Use files from</legend><label><input type="radio" name="batchSource" value="local"> Local folder</label><label><input type="radio" name="batchSource" value="archive" checked> Archive.org</label></fieldset>
      <p id="batchSourceNote"></p>
      <p>Issues 1–126 are faithful reproductions of the printed issues, preserving their original page layouts.</p>
      <p>Issues 127–172 use the expanded iPad editions, so they are less faithful to the printed issues. Related gallery images share a caption. Larger galleries continue onto a second page, with the caption on the first. Video buttons link back to the reader.</p>
      <p id="batchEstimate"></p><p id="batchStatus" role="status" aria-live="polite"></p>
      <progress id="batchProgress" hidden aria-label="PDF collection progress"></progress>
      <div id="batchDetails"></div>
      <div class="folder-actions"><button id="batchCheck" type="button">Check files</button><button id="batchBuild" type="button">Build all PDFs</button><button id="batchCancel" type="button" hidden>Pause</button><button id="batchReset" type="button" hidden>End export</button><a id="batchSave" hidden>Save ZIP</a><button id="batchDone" type="button" hidden>Done</button></div>
      <p id="batchMethod" class="folder-note"></p>`;
    info.append(section);
    const el = id => section.querySelector('#' + id), status = el('batchStatus'), progress = el('batchProgress');
    const folderSave = typeof showDirectoryPicker === 'function';
    const base = new URL('.', document.querySelector('script[src*="pdf-batch.js"]').src);
    let catalog = null, ready = [], job = null, output = null, session = null, checked = false, archiveLibrary, sourceChosen = false;
    const online = () => section.querySelector('[name="batchSource"]:checked').value === 'archive';
    function defaultSource() {
      if (sourceChosen || job || session || output) return;
      const value = sources.status().connected ? 'local' : 'archive';
      section.querySelector(`[name="batchSource"][value="${value}"]`).checked = true;
    }
    function script(file) {
      return new Promise((resolve, reject) => {
        const tag = document.createElement('script'); tag.src = new URL(file, base).href;
        tag.onload = () => { tag.remove(); resolve(); };
        tag.onerror = () => { tag.remove(); reject(Error('The PDF tools could not load. Try again.')); };
        document.head.append(tag);
      });
    }
    const catalogReady = script('../data/pdf-catalog.js?v=3').then(() => { catalog = window.CinefexPDFCatalog; estimate(); controls(); });
    catalogReady.catch(error => { status.textContent = error.message; controls(); });
    function files() { return session?.items || (online() ? catalog || [] : ready); }
    function estimate() {
      if (!catalog) return;
      const list = session?.items || (online() || !checked ? catalog : ready);
      el('batchEstimate').textContent = `${list.length} ${list.length === 1 ? 'PDF' : 'PDFs'}, ${folderSave ? 'estimated total' : 'estimated ZIP file size'} ${core.formatBytes(list.reduce((sum, item) => sum + item.estimatedBytes, 0))}`;
    }
    function controls() {
      defaultSource();
      const busy = !!job, remote = online(), locked = busy || !!session || !!output;
      for (const input of section.querySelectorAll('[name="batchSource"]')) input.disabled = locked;
      el('batchSourceNote').textContent = remote
        ? 'Download the catalogue from Archive.org, including the repairs for issues 11–16. This can take a very long time. Keep this page open while it works.'
        : 'Choose your local issue files above, then check which issues are complete. Issues 11–16 also need the repair files.';
      el('batchCheck').hidden = remote || !!session || !!output;
      el('batchCheck').disabled = busy || !catalog || !sources.status().connected;
      el('batchBuild').hidden = !!output || (!remote && !checked && !session);
      el('batchBuild').disabled = busy || !files().length;
      el('batchBuild').textContent = session ? 'Resume export' : files().length === 172 ? 'Build all PDFs' : `Build ${files().length} PDFs`;
      el('batchCancel').hidden = !busy;
      el('batchCancel').textContent = job?.kind === 'check' ? 'Cancel' : 'Pause';
      el('batchCancel').disabled = !!job?.cancelled;
      el('batchReset').hidden = busy || !session || !!output;
      progress.hidden = !busy && !session;
      if (!output) el('batchMethod').textContent = folderSave
        ? 'Choose an output folder when you start. Each issue is saved as a separate PDF. You can pause and resume while this page stays open.'
        : 'The PDFs are saved together in one ZIP. You can pause and resume while this page stays open.';
      for (const id of ['chooseLocalFolder', 'refreshLocalFolder', 'forgetLocalFolder']) {
        const button = info.querySelector('#' + id);
        if (button) button.disabled = locked || (id === 'chooseLocalFolder' && !sources.supported);
      }
    }
    function readyText() {
      status.textContent = online() ? 'Ready to download the catalogue.' : sources.status().connected
        ? 'Check which issues are complete in your local folder.' : 'Choose a local folder above.';
    }
    function pause() {
      if (!job) return;
      job.cancelled = true;
      job.controller?.abort();
      status.textContent = job.kind === 'check' ? 'Cancelling file check…' : 'Pausing…';
      controls();
    }
    async function clearOutput() {
      const previous = output; output = null;
      el('batchSave').hidden = el('batchDone').hidden = true;
      el('batchSave').removeAttribute('href');
      if (previous) { URL.revokeObjectURL(previous.url); await previous.archive.dispose(); }
    }
    async function endExport() {
      const previous = session; session = null;
      previous?.adapter?.clear();
      if (previous?.archive) await previous.archive.dispose();
      return previous;
    }
    async function inspect() {
      if (job || session || output) return;
      ready = []; checked = false; estimate(); el('batchDetails').replaceChildren();
      const run = { cancelled: false, kind: 'check' }; job = run; controls(); progress.value = 0; progress.max = 172;
      try {
        await catalogReady;
        const missing = [];
        for (const item of catalog) {
          core.check(run); status.textContent = `Checking issue ${item.issue} of 172…`;
          const data = await core.load(item.issue);
          const absent = await core.inspect(data, sources, run, p => { status.textContent = `Checking issue ${item.issue} of 172, file ${p.done} of ${p.total}`; });
          if (absent.size) missing.push(item.issue); else ready.push(item);
          progress.value = item.issue;
        }
        core.check(run); checked = true; estimate();
        status.textContent = missing.length ? `${ready.length} issues are ready. ${missing.length} need more local files.` : 'The full catalogue is ready.';
        if (missing.length) {
          const note = document.createElement('p');
          note.textContent = 'Missing files in issues ' + missing.join(', ') + '. These issues will be skipped. Add their files and check again to include them.';
          el('batchDetails').append(note);
        }
      } catch (error) { status.textContent = run.cancelled ? 'File check cancelled.' : error.message; }
      finally { if (job === run) { job = null; controls(); } }
    }
    async function outputFolder() {
      const parent = await showDirectoryPicker({ id: 'cinefex-pdf-output', mode: 'readwrite' });
      for (let n = 1; n < 1000; n++) {
        const name = 'Cinefex PDFs' + (n === 1 ? '' : ` (${n})`);
        try { await parent.getDirectoryHandle(name); }
        catch (error) {
          if (error.name === 'NotFoundError') return parent.getDirectoryHandle(name, { create: true });
          if (error.name !== 'TypeMismatchError') throw error;
        }
      }
      throw Error('Choose another output folder.');
    }
    async function build() {
      if (job || !files().length || output) return;
      const run = { cancelled: false, controller: new AbortController() };
      job = run; controls(); el('batchDetails').replaceChildren();
      let current = session;
      try {
        if (!current) {
          current = { items: [...files()], remote: online(), saved: 0 };
          if (folderSave) current.directory = await outputFolder();
          else {
            status.textContent = 'Preparing export…';
            current.archive = await CinefexPDFZip.create(current.items.reduce((sum, item) => sum + item.estimatedBytes, 0), () => core.check(job));
          }
          session = current;
        }
        core.check(run); estimate(); progress.max = current.items.length; progress.value = current.saved;
        if (current.remote && !current.adapter) {
          if (!window.CinefexPDFArchive) {
            archiveLibrary ||= script('pdf-archive.js?v=1').catch(error => { archiveLibrary = null; throw error; });
            await archiveLibrary;
          }
          current.adapter = CinefexPDFArchive.create();
        }
        while (current.saved < current.items.length) {
          core.check(run);
          const item = current.items[current.saved], data = await core.load(item.issue);
          core.check(run);
          if (current.remote) {
            await current.adapter.prepare(data, run.controller.signal, p => {
              core.check(run);
              progress.value = current.saved + .8 * p.done / p.total;
              status.textContent = `Issue ${item.issue}, downloaded ${p.done} of ${p.total} images, ${core.formatBytes(p.bytes)}${p.retry ? '. Retrying a download…' : ''}`;
              el('batchDetails').textContent = `${current.saved} of ${current.items.length} PDFs ${current.directory ? 'saved' : 'built'}`;
            });
          }
          const bytes = await core.build(data, current.remote ? current.adapter : sources, run, p => {
            status.textContent = p.phase === 'finish' ? `Finishing issue ${item.issue}…` : `Issue ${item.issue}, page ${p.done} of ${p.total}`;
            el('batchDetails').textContent = `${current.saved} of ${current.items.length} PDFs ${current.directory ? 'saved' : 'built'}`;
            progress.value = current.saved + (current.remote ? .8 : 0) + (current.remote ? .2 : 1) * p.done / p.total;
          });
          core.check(run);
          if (current.directory) {
            const name = core.filename(item.issue), file = await current.directory.getFileHandle(name, { create: true });
            let stream;
            try { stream = await file.createWritable(); await stream.write(bytes); core.check(run); await stream.close(); }
            catch (error) {
              if (stream) await stream.abort().catch(() => {});
              await current.directory.removeEntry(name).catch(() => {});
              throw error;
            }
          } else {
            status.textContent = `Adding issue ${item.issue} to ZIP…`;
            await current.archive.add(core.filename(item.issue), bytes);
          }
          current.saved++; progress.value = current.saved;
          current.adapter?.clear();
        }
        core.check(run);
        if (current.archive) {
          status.textContent = 'Finishing ZIP…';
          const file = await current.archive.finish();
          output = { archive: current.archive, url: URL.createObjectURL(file) }; current.archive = null;
          const save = el('batchSave');
          save.href = output.url; save.download = 'Cinefex PDFs.zip'; save.textContent = 'Save ZIP, ' + core.formatBytes(file.size); save.hidden = false;
          el('batchDone').hidden = false; el('batchDone').disabled = true;
          status.textContent = `${current.saved} PDFs ready to save.`;
          el('batchMethod').textContent = 'Choose Done once the download has finished.';
        } else status.textContent = `Saved ${current.saved} PDFs in “${current.directory.name}”.`;
        el('batchDetails').replaceChildren();
        await endExport();
      } catch (error) {
        if (session?.archive && !session.archive.usable) {
          await endExport();
          status.textContent = 'The temporary ZIP could not be recovered. Start a new export.';
          el('batchDetails').replaceChildren();
        } else if (session) {
          const count = `${session.saved} of ${session.items.length} PDFs ${session.directory ? 'saved' : 'built'}.`;
          status.textContent = run.cancelled ? `Paused. ${count}` : `${error.name === 'QuotaExceededError' ? 'There is not enough space. Free some space and try again.' : error.message} ${count}`;
          el('batchDetails').textContent = 'Resume export to continue from here. Keep this page open.';
        } else status.textContent = error.name === 'AbortError' ? 'No output folder selected.' : error.message;
      } finally {
        if (job === run) { job = null; controls(); }
      }
    }
    el('batchCheck').onclick = inspect;
    el('batchBuild').onclick = build;
    el('batchCancel').onclick = pause;
    el('batchReset').onclick = async () => {
      const previous = await endExport();
      status.textContent = previous?.directory && previous.saved ? `Export ended. ${previous.saved} complete PDFs remain in “${previous.directory.name}”.` : 'Export ended.';
      el('batchDetails').replaceChildren(); estimate(); controls();
    };
    el('batchSave').onclick = () => { el('batchDone').disabled = false; };
    el('batchDone').onclick = async () => {
      el('batchDone').disabled = true; await clearOutput(); status.textContent = 'Export cleared.'; estimate(); controls();
    };
    for (const input of section.querySelectorAll('[name="batchSource"]')) input.onchange = () => {
      sourceChosen = true;
      el('batchDetails').replaceChildren(); readyText(); estimate(); controls();
    };
    info.addEventListener('close', () => { if (!info.open) pause(); });
    addEventListener('cinefexsourcechange', () => {
      if (session || output) return;
      if (!online()) pause();
      checked = false; ready = [];
      defaultSource();
      if (!job) readyText(); estimate(); controls();
    });
    sources.ready.then(() => {
      defaultSource();
      if (!session && !job && !output) readyText();
      controls();
    });
    addEventListener('beforeunload', event => { if (job || session || output) { event.preventDefault(); event.returnValue = ''; } });
    addEventListener('pagehide', () => { pause(); endExport(); clearOutput(); });
    controls();
  });
})();
