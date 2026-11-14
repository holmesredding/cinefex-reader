(() => {
  'use strict';
  const issue = window.ISSUE;
  if (!issue || issue.issue < 1 || issue.issue > 172) return;
  const sources = window.CinefexSources, core = window.CinefexPDF;
  const archive = window.CinefexPDFArchive.create();
  const button = document.createElement('button');
  button.id = 'pdfExportButton';
  button.textContent = 'Create PDF';
  document.querySelector('.sidebar-bottom').prepend(button);

  const dialog = document.createElement('dialog');
  dialog.id = 'pdfExport';
  dialog.setAttribute('aria-labelledby', 'pdfExportTitle');
  dialog.innerHTML = `<div class="dialoghead"><h2 id="pdfExportTitle">Create PDF</h2><button type="button" class="icon-button" id="pdfClose" aria-label="Close PDF export">×</button></div>
    <fieldset class="pdf-source"><legend>Use files from</legend><label><input type="radio" name="pdfSource" value="local"> Local folder</label><label><input type="radio" name="pdfSource" value="archive" checked> Archive.org</label></fieldset>
    <p id="pdfSourceNote">Choose a local copy of this issue to build the PDF.</p>${issue.issue >= 127 ? '<p class="pdf-edition-note">This uses the expanded iPad edition, so it is less faithful to the printed issues. Related gallery images share a caption. Larger galleries continue onto a second page, with the caption on the first. Video buttons link back to the reader.</p>' : '<p class="pdf-edition-note">Issues 1–126 are faithful reproductions of the printed issues, preserving their original page layouts.</p>'}
    <p id="pdfStatus" role="status" aria-live="polite"></p>
    <progress id="pdfProgress" aria-label="PDF export progress" hidden></progress>
    <div id="pdfDetails"></div>
    <div class="pdf-actions"><button type="button" id="pdfChoose">Choose folder</button><button type="button" id="pdfRecheck">Recheck folder</button><button type="button" id="pdfCreate">Create PDF</button><button type="button" id="pdfCancel" hidden>Cancel</button><a id="pdfSave" hidden>Save PDF</a></div>`;
  document.body.append(dialog);
  const el = id => dialog.querySelector('#' + id);
  const status = el('pdfStatus'), progress = el('pdfProgress'), details = el('pdfDetails');
  let running = null, outputURL = null;
  const online = () => dialog.querySelector('[name="pdfSource"]:checked').value === 'archive';
  function readyText() {
    if (online()) return archive.count ? `${archive.count} images downloaded. Ready to resume.` : 'Ready to download this issue.';
    return sources.status().connected ? 'Ready to check the local files for this issue.' : 'Choose the folder containing your issue files.';
  }

  function clearOutput() {
    if (outputURL) URL.revokeObjectURL(outputURL);
    outputURL = null;
    el('pdfSave').hidden = true;
    el('pdfSave').removeAttribute('href');
  }
  function controls() {
    const connected = sources.status().connected, busy = !!running, remote = online();
    for (const input of dialog.querySelectorAll('[name="pdfSource"]')) input.disabled = busy;
    el('pdfSourceNote').textContent = remote ? 'Archive.org can be very slow. Keep this tab open while the images download.' : 'A local copy of this issue is required for this option.';
    el('pdfChoose').hidden = remote;
    el('pdfChoose').textContent = connected ? 'Change folder' : 'Choose folder';
    el('pdfChoose').disabled = busy || !sources.supported;
    el('pdfRecheck').hidden = remote || !connected;
    el('pdfRecheck').disabled = busy;
    el('pdfCreate').hidden = !!outputURL;
    el('pdfCreate').disabled = busy || (!remote && !connected);
    el('pdfCreate').textContent = remote && archive.count ? 'Resume PDF' : 'Create PDF';
    el('pdfCancel').hidden = !busy || running.kind === 'folder';
    progress.hidden = !busy;
  }
  function stopped() {
    if (!running) return;
    running.cancelled = true;
    running.controller?.abort();
    running = null;
    clearOutput();
    pageCache.resume();
    controls();
  }
  function check(job) {
    if (job.cancelled || running !== job) throw new DOMException('Cancelled', 'AbortError');
  }
  function missingFiles(missing, data) {
    const affected = data.pages.flatMap((page, i) => page.some(layer => missing.has(layer[0])) ? [i + 1] : []);
    status.textContent = `Local files are missing or unreadable for ${affected.length} ${affected.length === 1 ? 'page' : 'pages'}. No PDF was created.`;
    const p = document.createElement('p');
    p.textContent = 'Pages: ' + affected.slice(0, 20).join(', ') + (affected.length > 20 ? '…' : '');
    details.append(p);
    const repairMissing = [...missing].some(i => data.assets[i].includes('/cinefex-reader-repairs-011-016/'));
    const originalMissing = [...missing].some(i => !data.assets[i].includes('/cinefex-reader-repairs-011-016/'));
    const help = document.createElement('p');
    if (originalMissing) help.append('Add the original files for this issue to your selected folder. ');
    if (repairMissing) {
      help.append('Add the ');
      const link = document.createElement('a');
      link.href = 'https://archive.org/details/cinefex-reader-repairs-011-016';
      link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = 'repair ZIP for issues 11–16';
      help.append(link, ' to the same folder. ');
    }
    help.append('Then recheck the folder and try again.');
    details.append(help);
  }
  async function create() {
    if (running || (!online() && !sources.status().connected)) return;
    clearOutput(); details.replaceChildren();
    const job = { cancelled: false, online: online(), controller: new AbortController() };
    running = job; pageCache.pause(); controls();
    progress.removeAttribute('value'); status.textContent = job.online ? 'Preparing download…' : 'Checking local files…';
    try {
      const data = await core.load(issue.issue); check(job);
      if (job.online) {
        await archive.prepare(data, job.controller.signal, p => {
          check(job); progress.max=p.total; progress.value=p.done;
          status.textContent=`Downloaded ${p.done} of ${p.total} images, ${core.formatBytes(p.bytes)}${p.retry ? '. Retrying a download…' : ''}`;
        });
        check(job);
      } else {
        const missing = await core.inspect(data, sources, job, p => { progress.max=p.total;progress.value=p.done;status.textContent=`Checking local file ${p.done} of ${p.total}…`; });
        if (missing.size) { missingFiles(missing, data); return; }
      }
      const bytes = await core.build(data, job.online ? archive : sources, job, p => { progress.max=p.total;progress.value=p.done;status.textContent=p.phase==='finish'?'Finishing PDF…':`Creating page ${p.done} of ${p.total}…`; });
      check(job);
      const blob = new Blob([bytes], { type: 'application/pdf' });
      outputURL = URL.createObjectURL(blob);
      const save = el('pdfSave');
      save.href = outputURL;
      save.download = `Cinefex ${String(issue.issue).padStart(3, '0')}.pdf`;
      save.hidden = false;
      status.textContent = `Ready to save. ${data.pages.length} pages, ${core.formatBytes(blob.size)}`;
    } catch (error) {
      if (running === job && error.name !== 'AbortError') {
        clearOutput();
        status.textContent = error.message || 'The PDF could not be created. Please try again.';
      }
    } finally {
      if (running === job) { running = null; pageCache.resume(); controls(); }
    }
  }
  async function folder(recheck) {
    details.replaceChildren(); clearOutput();
    status.textContent = 'Checking folder…';
    const job = { cancelled: false, kind: 'folder' }; running = job; progress.removeAttribute('value'); controls();
    try {
      await (recheck ? sources.refresh() : sources.status().needsPermission ? sources.reconnect() : sources.choose());
      if (running === job) status.textContent = sources.status().connected ? 'Folder connected. Ready to check this issue.' : 'Choose the folder containing your issue files.';
    } catch (error) { if (running === job) status.textContent = error.name === 'AbortError' ? 'Folder selection cancelled.' : error.message; }
    finally { if (running === job) { running = null; controls(); } }
  }
  button.onclick = async () => {
    await sources.ready;
    details.replaceChildren(); clearOutput();
    el('pdfExportTitle').textContent = `Cinefex ${issue.issue} PDF`;
    status.textContent = readyText();
    controls(); dialog.showModal();
  };
  el('pdfChoose').onclick = () => folder(false);
  el('pdfRecheck').onclick = () => folder(true);
  el('pdfCreate').onclick = create;
  el('pdfCancel').onclick = () => { stopped(); status.textContent = online() && archive.count ? 'PDF cancelled. Downloaded images are kept while you stay on this issue.' : 'PDF cancelled.'; };
  el('pdfClose').onclick = () => dialog.close();
  dialog.addEventListener('close', () => { stopped(); clearOutput(); });
  addEventListener('cinefexsourcechange', () => {
    if (!online()) { stopped(); clearOutput(); }
    controls();
    if (dialog.open && !running) status.textContent = readyText();
  });
  for (const input of dialog.querySelectorAll('[name="pdfSource"]')) input.onchange = () => {
    clearOutput(); details.replaceChildren(); controls(); status.textContent = readyText();
  };
  addEventListener('cinefexfolderprogress', event => { if (running?.kind === 'folder') status.textContent = event.detail; });
  addEventListener('pagehide', () => { stopped(); clearOutput(); archive.clear(); });
})();
