(() => {
  'use strict';
  const grid = document.querySelector('#issueGrid, #titleGrid');
  const selector = document.getElementById('view');
  const key = 'cinefex-browse-view';
  const valid = value => ['small', 'large', 'list'].includes(value);
  let selected = 'small';
  try { const saved = localStorage.getItem(key); if (valid(saved)) selected = saved; } catch {}
  function apply(value) {
    selected = valid(value) ? value : 'small';
    selector.value = selected;
    grid.dataset.view = selected;
  }
  selector.addEventListener('change', () => {
    apply(selector.value);
    try { localStorage.setItem(key, selected); } catch {}
  });
  addEventListener('storage', event => { if (event.key === key) apply(event.newValue); });
  apply(selected);

  const pending = new WeakMap();
  const observer = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const image = entry.target, url = pending.get(image);
      observer.unobserve(image);
      pending.delete(image);
      if (url && image.isConnected) CinefexSources.image(image, url);
    }
  }, { rootMargin: '600px 0px' }) : null;
  window.CinefexBrowse = {
    image(image, url) {
      image.loading = 'lazy';
      image.decoding = 'async';
      if (observer) { pending.set(image, url); observer.observe(image); }
      else CinefexSources.image(image, url);
    },
    clear() {
      observer?.disconnect();
      for (const image of grid.querySelectorAll('img')) { pending.delete(image); CinefexSources.releaseImage(image); }
      grid.replaceChildren();
    }
  };
})();
