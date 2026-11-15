(() => {
  'use strict';
  const normalize = value => String(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const words = value => normalize(value).split(' ').filter(Boolean);
  window.CinefexFilter = {
    words,
    matches: (haystack, query) => query.every(part => haystack.some(word => word.startsWith(part)))
  };
  for (const form of document.querySelectorAll('[data-catalogue-search]')) {
    form.addEventListener('submit', event => {
      event.preventDefault();
      const input = form.elements.q, q = input.value.trim();
      if (!q) { input.focus(); return; }
      const link = document.createElement('a');
      link.href = 'search.html?' + new URLSearchParams({ q });
      link.hidden = true;
      document.body.append(link);
      link.click();
      link.remove();
    });
  }
})();
