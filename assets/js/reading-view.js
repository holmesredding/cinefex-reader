(() => {
  'use strict';
  const config = window.CINEFEX_READING, reader = window.CinefexReader, issue = window.ISSUE;
  if (!config || !reader || issue.issue !== config.issue) return;
  const $ = id => document.getElementById(id), byIndex = new Map(), jobs = new Map();
  for (const article of config.articles) {
    if (!article.localOnly) for (const index of article.indices) byIndex.set(index, article);
    for (const item of Object.values(article.images || {})) if (item.local) issue.localAssets[item.url] = item.local;
  }
  const requestedView = new URLSearchParams(location.search).get('reading');
  let followsDefault = !['page', 'fit', 'text'].includes(requestedView);
  let mode = followsDefault ? window.CinefexViewPreference?.get() || 'page' : requestedView;
  let size = 21, activeArticle = null, builtArticle = null, revision = 0, updatingPage = false, scrollFrame = 0, alignedTop = null, imageRef = '';
  let position = { ref: issue.pages[reader.current].ref, fraction: 0 }, pendingPosition = null;
  const layout = index => byIndex.has(index) && (mode === 'text' || (mode === 'fit' && byIndex.get(index).crop)) ? mode : 'page';
  try { size = Math.max(16, Math.min(30, Number(localStorage.getItem('cinefex-text-size')) || 21)); } catch {}
  const heading = document.querySelector('.reading-heading');
  const views = document.createElement('div'); views.className = 'reading-views'; views.setAttribute('role', 'group'); views.setAttribute('aria-label', 'Article view');
  function switchView(value, explicit = true) {
    const changed = mode !== value;
    followsDefault = !explicit;
    pendingPosition = capturePosition(); cancelAnimationFrame(scrollFrame); scrollFrame = 0;
    mode = value; const url = new URL(location.href);
    explicit ? url.searchParams.set('reading', value) : url.searchParams.delete('reading');
    url.hash = 'page=' + encodeURIComponent(pendingPosition.ref); history.replaceState(history.state, '', url);
    if (changed) reader.show(issue.pages.findIndex(p => p.ref === pendingPosition.ref), 'none');
    else pendingPosition = null;
  }
  for (const [value, label] of [['page', 'Page'], ['fit', 'Fit text'], ['text', 'Reader view']]) {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = label; button.dataset.readingView = value;
    button.onclick = () => switchView(value); views.append(button);
  }
  heading.prepend(views);
  const panel = document.createElement('section'); panel.id = 'articleReading'; panel.className = 'article-reading'; panel.hidden = true; panel.tabIndex = 0;
  const tools = document.createElement('div'); tools.className = 'article-tools';
  tools.innerHTML = '<div class="article-size"><span>Text size</span><button type="button" aria-label="Decrease text size">−</button><output></output><button type="button" aria-label="Increase text size">+</button></div><button type="button" class="article-gallery">Gallery</button>';
  const sizeButtons = tools.querySelectorAll('.article-size button'), sizeOutput = tools.querySelector('output'), gallery = tools.querySelector('.article-gallery');
  const status = document.createElement('p'); status.className = 'article-status'; status.setAttribute('role', 'status');
  const retry = document.createElement('button'); retry.type = 'button'; retry.className = 'article-retry'; retry.textContent = 'Retry'; retry.hidden = true;
  const prose = document.createElement('article'); prose.className = 'article-prose';
  const crop = document.createElement('div'); crop.className = 'article-crop';
  const cropImage = document.createElement('img'); cropImage.decoding = 'async'; cropImage.draggable = false; crop.append(cropImage);
  panel.append(tools, status, retry, prose, crop); $('viewport').after(panel);
  gallery.onclick = () => reader.show(activeArticle.gallery);
  retry.onclick = () => { pendingPosition = position; sync(reader.current); };
  function setSize(next) {
    position = capturePosition(); size = Math.max(16, Math.min(30, next)); panel.style.setProperty('--article-size', size + 'px'); sizeOutput.textContent = size + 'px';
    sizeButtons[0].disabled = size <= 16; sizeButtons[1].disabled = size >= 30; applyPosition();
    try { localStorage.setItem('cinefex-text-size', String(size)); } catch {}
  }
  sizeButtons[0].onclick = () => setSize(size - 1); sizeButtons[1].onclick = () => setSize(size + 1);
  const lazy = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) { lazy.unobserve(entry.target); loadPhoto(entry.target); }
  }, { root: panel, rootMargin: '600px' });
  function loadPhoto(image) { CinefexSources.image(image, image.dataset.articleSrc); }
  const photoDialog = document.createElement('dialog'); photoDialog.className = 'article-photo-dialog'; photoDialog.setAttribute('aria-label', 'Photograph');
  photoDialog.innerHTML = '<div class="article-photo-controls"><button type="button" data-photo-previous>Previous</button><span data-photo-count></span><button type="button" data-photo-next>Next</button><button type="button" data-photo-close>Close</button></div><div class="article-photo-large"><img alt=""></div><div class="article-photo-caption"></div>';
  document.body.append(photoDialog);
  let openPhotos = [], openIndex = 0, photoOpener = null;
  const largePhoto = photoDialog.querySelector('img');
  function showPhoto(index) {
    openIndex = index; const item = openPhotos[index];
    cropPhoto(largePhoto, largePhoto.parentElement, item);
    largePhoto.width = item.size[0]; largePhoto.height = item.size[1]; largePhoto.alt = 'Photograph ' + (index + 1);
    CinefexSources.image(largePhoto, item.url);
    photoDialog.querySelector('[data-photo-count]').textContent = openPhotos.length > 1 ? `${index + 1} of ${openPhotos.length}` : '';
    for (const [selector, disabled] of [['[data-photo-previous]', index === 0], ['[data-photo-next]', index === openPhotos.length - 1]]) {
      const button = photoDialog.querySelector(selector); button.disabled = disabled; button.hidden = openPhotos.length === 1;
    }
  }
  photoDialog.querySelector('[data-photo-close]').onclick = () => photoDialog.close();
  photoDialog.querySelector('[data-photo-previous]').onclick = () => showPhoto(openIndex - 1);
  photoDialog.querySelector('[data-photo-next]').onclick = () => showPhoto(openIndex + 1);
  photoDialog.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' && openIndex) { event.preventDefault(); showPhoto(openIndex - 1); }
    if (event.key === 'ArrowRight' && openIndex < openPhotos.length - 1) { event.preventDefault(); showPhoto(openIndex + 1); }
    event.stopPropagation();
  });
  photoDialog.addEventListener('close', () => { CinefexSources.releaseImage(largePhoto); largePhoto.removeAttribute('src'); photoOpener?.focus({ preventScroll: true }); });
  function cropPhoto(image, frame, item) {
    frame.classList.toggle('article-cropped', Boolean(item.crop));
    frame.style.removeProperty('--photo-ratio');
    image.removeAttribute('style');
    if (!item.crop) return;
    const [x, y, width, height] = item.crop;
    frame.style.setProperty('--photo-ratio', String(item.size[0] * width / (item.size[1] * height)));
    image.style.cssText = `width:${100 / width}%;height:${100 / height}%;left:${-100 * x / width}%;top:${-100 * y / height}%;`;
  }
  function figure(images, caption) {
    const figure = document.createElement('figure'); figure.className = 'article-figure';
    const photos = document.createElement('div'); photos.className = 'article-photos'; photos.dataset.count = String(images.length);
    const text = document.createElement('figcaption'); text.append(caption);
    images.forEach((item, index) => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'article-photo'; button.setAttribute('aria-label', 'Enlarge photograph' + (images.length > 1 ? ' ' + (index + 1) : ''));
      const image = document.createElement('img'); image.alt = ''; image.width = item.size[0]; image.height = item.size[1]; image.decoding = 'async'; image.dataset.articleSrc = item.url;
      image.onerror = () => { button.classList.add('photo-failed'); button.setAttribute('aria-label', 'Retry photograph'); };
      image.onload = () => { button.classList.remove('photo-failed'); button.setAttribute('aria-label', 'Enlarge photograph' + (images.length > 1 ? ' ' + (index + 1) : '')); };
      cropPhoto(image, button, item);
      button.append(image); photos.append(button); lazy.observe(image);
      button.onclick = () => {
        if (button.classList.contains('photo-failed')) { loadPhoto(image); return; }
        openPhotos = images; photoOpener = button; photoDialog.querySelector('.article-photo-caption').replaceChildren(...[...text.childNodes].map(node => node.cloneNode(true))); showPhoto(index); photoDialog.showModal();
      };
    });
    figure.append(photos); if (text.textContent.trim()) figure.append(text); return figure;
  }
  async function loadText(article) {
    if (article.format === 'indexed') return '';
    if (!jobs.has(article.source)) {
      const job = (async () => {
        const name = decodeURIComponent(article.source).split('/').at(-1);
        const local = await CinefexSources.resolve(article.source, { name, path: `issues/${issue.issue}/assets/${name}`, size: article.sourceBytes, crc: article.sourceCrc });
        let bytes;
        if (local) bytes = new Uint8Array(await local.arrayBuffer());
        else {
          if (article.localOnly) throw Error('Local article unavailable');
          const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 30000);
          try { const response = await fetch(article.source, { cache: 'force-cache', signal: controller.signal }); if (!response.ok) throw Error('Article unavailable'); bytes = new Uint8Array(await response.arrayBuffer()); }
          finally { clearTimeout(timeout); }
        }
        let crc = 0xffffffff;
        for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1; }
        if (bytes.length !== article.sourceBytes || ((crc ^ 0xffffffff) >>> 0) !== article.sourceCrc) throw Error('Article format changed');
        return new TextDecoder().decode(bytes);
      })().catch(error => { jobs.delete(article.source); throw error; });
      jobs.set(article.source, job);
      if (jobs.size > 6) jobs.delete(jobs.keys().next().value);
    }
    return jobs.get(article.source);
  }
  function clearArticle() {
    lazy.disconnect(); for (const image of prose.querySelectorAll('img')) CinefexSources.releaseImage(image);
    prose.replaceChildren(); builtArticle = null;
  }
  function anchors() {
    const origin = panel.getBoundingClientRect().top - panel.scrollTop + tools.offsetHeight + 24;
    const points = [];
    for (const element of prose.querySelectorAll('[data-article-anchor]')) {
      if (element.parentElement.closest('[data-article-anchor]')) continue;
      const rect = element.getClientRects()[0]; if (!rect) continue;
      points.push({ ref: element.dataset.articlePage, anchor: element.dataset.articleAnchor, top: points.length ? Math.max(0, rect.top - origin) : 0 });
    }
    points.forEach((point, i) => { point.bottom = points[i + 1]?.top ?? prose.querySelector('.article-end').getBoundingClientRect().top - origin; });
    return points;
  }
  const clamp = value => Math.max(0, Math.min(1, value));
  function capturePosition() {
    if (panel.hidden) return position;
    if (alignedTop !== null) { if (Math.abs(panel.scrollTop - alignedTop) < 1) return position; alignedTop = null; }
    if (layout(reader.current) === 'text' && builtArticle === activeArticle) {
      const points = anchors(), point = points.findLast(p => p.top <= panel.scrollTop + .5) || points[0];
      if (point) {
        const page = points.filter(p => p.ref === point.ref);
        return { ref: point.ref, anchor: point.anchor, fraction: clamp((panel.scrollTop - point.top) / Math.max(1, point.bottom - point.top)), pageFraction: clamp((panel.scrollTop - page[0].top) / Math.max(1, page.at(-1).bottom - page[0].top)) };
      }
    }
    if (layout(reader.current) === 'fit' && crop.clientHeight) {
      const top = crop.getBoundingClientRect().top - panel.getBoundingClientRect().top + panel.scrollTop;
      return { ref: issue.pages[reader.current].ref, fraction: panel.scrollTop ? clamp((panel.scrollTop + 24 - top) / crop.clientHeight) : 0 };
    }
    return position;
  }
  function applyPosition() {
    if (panel.hidden) return;
    if (layout(reader.current) === 'text' && builtArticle === activeArticle) {
      const points = anchors();
      const point = points.find(p => p.ref === position.ref && p.anchor === position.anchor) || points.find(p => p.ref === position.ref) || points.reduce((best, p) => Math.abs(parseFloat(p.ref) - parseFloat(position.ref)) < Math.abs(parseFloat(best.ref) - parseFloat(position.ref)) ? p : best, points[0]);
      if (point) {
        const page = points.filter(p => p.ref === point.ref);
        const bottom = position.anchor === undefined ? page.at(-1).bottom : point.bottom;
        panel.scrollTop = point.top + position.fraction * Math.max(0, bottom - point.top);
      }
    } else if (layout(reader.current) === 'fit') {
      const top = crop.getBoundingClientRect().top - panel.getBoundingClientRect().top + panel.scrollTop;
      const fraction = position.pageFraction ?? position.fraction;
      panel.scrollTop = fraction ? top + fraction * crop.clientHeight - 24 : 0;
    }
    alignedTop = panel.scrollTop;
  }
  panel.addEventListener('scroll', () => {
    if (panel.hidden || scrollFrame) return;
    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = 0; if (panel.hidden) return; position = capturePosition();
      const index = issue.pages.findIndex(p => p.ref === position.ref);
      if (index >= 0 && index !== reader.current && byIndex.get(index) === activeArticle) {
        updatingPage = true; try { reader.show(index, 'replace'); } finally { updatingPage = false; }
      }
    });
  }, { passive: true });
  async function sync(index) {
    if (updatingPage) return;
    const token = ++revision, currentLayout = layout(index), active = currentLayout !== 'page';
    activeArticle = byIndex.get(index); position = pendingPosition || { ref: issue.pages[index].ref, fraction: 0 }; pendingPosition = null;
    views.hidden = !activeArticle; panel.hidden = !active; $('viewport').hidden = active; $('zoomButton').hidden = active;
    heading.querySelector('.controls-button').hidden = active;
    for (const button of views.children) { button.hidden = button.dataset.readingView === 'fit' && !activeArticle?.crop; button.setAttribute('aria-pressed', String(button.dataset.readingView === currentLayout)); }
    if (!active) return;
    const article = activeArticle; panel.setAttribute('aria-label', article.title); reader.pause();
    tools.hidden = currentLayout !== 'text'; gallery.hidden = article.gallery === undefined; prose.hidden = currentLayout !== 'text'; crop.hidden = currentLayout !== 'fit'; status.hidden = true; retry.hidden = true;
    if (currentLayout === 'fit') {
      const ref = issue.pages[index].ref;
      if (imageRef !== ref) {
        imageRef = ref; const [x, y, w, h] = ref === article.startRef ? article.firstCrop : article.crop;
        crop.style.aspectRatio = w + '/' + h; cropImage.style.width = 1024 / w * 100 + '%'; cropImage.style.height = 768 / h * 100 + '%'; cropImage.style.left = -x / w * 100 + '%'; cropImage.style.top = -y / h * 100 + '%'; cropImage.alt = article.title;
        status.textContent = 'Loading page…'; status.hidden = false;
        cropImage.onload = () => { if (layout(reader.current) === 'fit' && imageRef === ref) { position = capturePosition(); status.hidden = true; applyPosition(); } };
        cropImage.onerror = () => { if (layout(reader.current) !== 'fit' || imageRef !== ref) return; status.textContent = 'This page could not load.'; status.hidden = false; retry.hidden = false; imageRef = ''; };
        CinefexSources.image(cropImage, issue.pages[index].preview);
      }
      applyPosition(); return;
    }
    if (builtArticle !== article) {
      clearArticle(); status.textContent = 'Loading article…'; status.hidden = false;
      try {
        let raw = await loadText(article); if (token !== revision) return;
        const documents = await Promise.all((article.extraSources || []).map(loadText));
        const index = article.needsIndex ? await CinefexSearchData.load('text/' + issue.issue) : null;
        if (token !== revision) return;
        if (article.format === 'native') for (const [before, after] of Object.entries(article.replacements || {})) raw = raw.split(before).join(after);
        const doc = new DOMParser().parseFromString(raw, 'text/html');
        CinefexArticleContent.render(doc, article, prose, figure, { documents: documents.map(text => new DOMParser().parseFromString(text, 'text/html')), index }); builtArticle = article;
      } catch {
        if (token === revision) { clearArticle(); status.textContent = 'The article could not load.'; status.hidden = false; retry.hidden = false; }
        return;
      }
    }
    if (token !== revision) return; status.hidden = true; applyPosition();
  }
  window.CinefexReadingView = {
    preservePosition: () => { position = capturePosition(); },
    active: () => layout(reader.current) !== 'page', handles: index => layout(index) !== 'page',
    key: event => {
      if (panel.hidden || event.key !== ' ' || event.ctrlKey || event.metaKey || event.altKey || document.querySelector('dialog[open]')) return false;
      event.preventDefault?.(); panel.scrollBy({ top: (event.shiftKey ? -1 : 1) * panel.clientHeight * .8 }); return true;
    }
  };
  addEventListener('cinefexpagechange', event => sync(event.detail.index));
  addEventListener('cinefexviewpreferencechange', event => {
    if (event.detail.apply || (event.detail.initial && followsDefault)) switchView(event.detail.value, false);
  });
  let sourceRevision = 0;
  async function updateLocalArticles() {
    const token = ++sourceRevision;
    for (const article of config.articles.filter(a => a.localOnly)) {
      const name = decodeURIComponent(article.source).split('/').at(-1);
      const local = await CinefexSources.resolve(article.source, { name, path: `issues/${issue.issue}/assets/${name}`, size: article.sourceBytes, crc: article.sourceCrc });
      if (token !== sourceRevision) return;
      for (const index of article.indices) local ? byIndex.set(index, article) : byIndex.delete(index);
    }
    pendingPosition = capturePosition(); imageRef = ''; clearArticle(); jobs.clear(); reader.show(reader.current, 'none');
  }
  addEventListener('cinefexsourcechange', updateLocalArticles);
  new ResizeObserver(() => { if (!panel.hidden) applyPosition(); }).observe(panel);
  setSize(size); sync(reader.current);
  if (config.articles.some(a => a.localOnly)) updateLocalArticles();
})();
