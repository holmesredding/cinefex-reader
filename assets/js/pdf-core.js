(() => {
  'use strict';
  const base = new URL('.', document.currentScript.src), loads = new Map();
  let library;
  const check = job => { if (job?.cancelled) throw new DOMException('Cancelled', 'AbortError'); };
  const yieldTask = () => new Promise(resolve => setTimeout(resolve, 0));
  function script(path) {
    return new Promise((resolve, reject) => {
      const el = document.createElement('script'); el.src = new URL(path, base).href;
      el.onload = () => { el.remove(); resolve(); };
      el.onerror = () => { el.remove(); reject(Error('The PDF tools could not load. Please try again.')); };
      document.head.append(el);
    });
  }
  function arrange(data) {
    if (!data.galleryLayouts?.length) return data;
    const groups = new Map(data.galleryLayouts.map(group => [group.states[0], group]));
    const pages = [], texts = {}, links = {}, sourcePageMap = new Map();
    for (let i = 0; i < data.pages.length;) {
      const group = groups.get(i);
      if (group) {
        for (const page of group.pages) {
          const index = pages.length;
          for (const source of page.states) sourcePageMap.set(source, index);
          pages.push(page.layers);
          if (page.texts?.length) texts[index] = page.texts;
          if (page.links?.length) links[index] = page.links;
        }
        i = group.states.at(-1) + 1;
      } else {
        const index = pages.length;
        sourcePageMap.set(i, index); pages.push(data.pages[i]);
        if (data.texts?.[i]) texts[index] = data.texts[i];
        if (data.links?.[i]) links[index] = data.links[i];
        i++;
      }
    }
    if (sourcePageMap.size !== data.pages.length) throw Error('The PDF page list is incomplete.');
    for (const index of Object.keys(links)) links[index] = links[index].map(link =>
      link.page === undefined ? link : { ...link, page: sourcePageMap.get(link.page) });
    const bookmarks = (data.bookmarks || []).map(bookmark => ({ ...bookmark, page: sourcePageMap.get(bookmark.page) }));
    return { ...data, pages, texts, links, bookmarks, sourcePageMap: Object.fromEntries(sourcePageMap) };
  }
  async function load(issue) {
    if (!Number.isInteger(issue) || issue < 1 || issue > 172) throw Error('Invalid issue');
    if (!loads.has(issue)) loads.set(issue, script(`../../issues/${issue}/pdf-pages.js?v=3`).then(() => {
      const data = window.CinefexPDFLayouts?.[issue];
      if (!data || data.issue !== issue || !data.pages.length) throw Error('The PDF page list could not load.');
      return arrange(data);
    }).catch(error => { loads.delete(issue); throw error; }));
    return loads.get(issue);
  }
  async function inspect(data, sources, job, progress = () => {}) {
    const missing = new Set();
    for (let i = 0; i < data.assets.length; i++) {
      check(job); const url = data.assets[i], blob = await sources.resolve(url, data.metadata[url]); check(job);
      if (!blob) missing.add(i);
      progress({ phase: 'check', done: i + 1, total: data.assets.length });
      if (i % 16 === 15) await yieldTask();
    }
    return missing;
  }
  async function imageAsPNG(bytes, job) {
    const bitmap = await createImageBitmap(new Blob([bytes]));
    const canvas = document.createElement('canvas');
    try {
      check(job);
      canvas.width = bitmap.width; canvas.height = bitmap.height;
      const context = canvas.getContext('2d', { colorSpace: 'srgb' });
      context.drawImage(bitmap, 0, 0);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      check(job);
      if (!blob) throw Error('Image conversion failed');
      return new Uint8Array(await blob.arrayBuffer());
    } finally { bitmap.close(); canvas.width = canvas.height = 0; }
  }
  async function build(data, sources, job, progress = () => {}) {
    library ||= script('../vendor/pdf-lib.min.js').catch(error => { library = null; throw error; });
    await library; check(job);
    const { PDFDocument, PDFName, PDFString, PDFHexString, StandardFonts, rgb,
      pushGraphicsState, popGraphicsState, rectangle, clip, endPath } = window.PDFLib;
    const pdf = await PDFDocument.create();
    pdf.setTitle(`Cinefex ${data.issue}`); pdf.setCreator('Cinefex Reader');
    if (data.edition === 'expanded') pdf.setSubject('Adapted from the expanded iPad edition. Related gallery images share a caption. The layout and pagination differ from print.');
    const scale = .75, pages = data.pages.map(() => pdf.addPage([data.width * scale, data.height * scale]));
    const images = new Map(); let headingFont;
    for (let i = 0; i < data.pages.length; i++) {
      check(job); progress({ phase: 'build', done: i + 1, total: pages.length });
      const page = pages[i];
      let drawn = 0;
      for (const [asset, x, y, width, height, crop] of data.pages[i]) {
        check(job); let image = images.get(asset);
        if (!image) {
          const url = data.assets[asset], blob = await sources.resolve(url, data.metadata[url]); check(job);
          if (!blob) throw Error(`A local file for page ${i + 1} is no longer available. Recheck the folder and try again.`);
          const bytes = new Uint8Array(await blob.arrayBuffer()); check(job);
          try {
            if (bytes[0] === 0x89 && bytes[1] === 0x50) image = await pdf.embedPng(bytes);
            else if (bytes[0] === 0xff && bytes[1] === 0xd8) image = await pdf.embedJpg(bytes);
            else image = await pdf.embedPng(await imageAsPNG(bytes, job));
          }
          catch { throw Error(`An image on page ${i + 1} could not be read. No PDF was created.`); }
          images.set(asset, image); await image.embed();
        }
        check(job);
        if (crop) {
          const [cx, cy, cw, ch] = crop;
          page.pushOperators(pushGraphicsState(), rectangle(cx * scale, (data.height - cy - ch) * scale, cw * scale, ch * scale), clip(), endPath());
        }
        page.drawImage(image, { x: x * scale, y: (data.height - y - height) * scale, width: width * scale, height: height * scale });
        if (crop) page.pushOperators(popGraphicsState());
        if (++drawn % 24 === 0) await yieldTask();
      }
      for (const text of data.texts?.[i] || []) {
        headingFont ||= await pdf.embedFont(StandardFonts.HelveticaBold);
        page.drawText(text.text, { x: text.x * scale, y: (data.height - text.y) * scale, size: text.size * scale, font: headingFont, color: rgb(...text.color) });
      }
      for (const link of data.links?.[i] || []) {
        const [x,y,w,h] = link.rect;
        const annotation = { Type: 'Annot', Subtype: 'Link', Rect: [x*scale,(data.height-y-h)*scale,(x+w)*scale,(data.height-y)*scale], Border: [0,0,0] };
        if (link.url) annotation.A = { S: 'URI', URI: PDFString.of(link.url) };
        else if (pages[link.page]) annotation.Dest = [pages[link.page].ref, PDFName.of('Fit')];
        else continue;
        page.node.addAnnot(pdf.context.register(pdf.context.obj(annotation)));
      }
      await yieldTask();
    }
    const bookmarks = (data.bookmarks || []).filter(b => pages[b.page]);
    if (bookmarks.length) {
      const root = pdf.context.obj({ Type: 'Outlines', Count: bookmarks.length }), rootRef = pdf.context.register(root);
      const nodes = bookmarks.map(b => pdf.context.obj({ Title: PDFHexString.fromText(b.title), Parent: rootRef, Dest: [pages[b.page].ref, PDFName.of('Fit')] }));
      const refs = nodes.map(node => pdf.context.register(node));
      nodes.forEach((node,i) => { if(i) node.set(PDFName.of('Prev'),refs[i-1]);if(i+1<refs.length)node.set(PDFName.of('Next'),refs[i+1]); });
      root.set(PDFName.of('First'),refs[0]);root.set(PDFName.of('Last'),refs.at(-1));pdf.catalog.set(PDFName.of('Outlines'),rootRef);
    }
    check(job); progress({ phase: 'finish', done: pages.length, total: pages.length });
    const bytes = await pdf.save({ objectsPerTick: 20 }); check(job); return bytes;
  }
  window.CinefexPDF = { load, inspect, build, check, filename: n => `Cinefex ${String(n).padStart(3,'0')}.pdf`, formatBytes: n => n >= 1e9 ? (n/1e9).toFixed(1)+' GB' : (n/1e6).toFixed(1)+' MB' };
})();
