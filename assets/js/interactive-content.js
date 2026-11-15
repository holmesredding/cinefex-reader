(() => {
  'use strict';
  function lines(page) {
    const copy = page.cloneNode(true);
    for (const br of copy.querySelectorAll('br')) br.replaceWith('\n');
    return copy.textContent.split(/[\r\n]+/).map(s => s.trim()).filter(Boolean);
  }
  function render(doc, article, prose, figure, mark, extra = {}) {
    const pages = [...doc.querySelectorAll('page')].map(lines);
    const original = article.flow.prefix + article.flow.lines.map(([page, line, end]) => {
      if (pages[page]?.[line] === undefined) throw Error('Article line unavailable');
      return pages[page][line].slice(0, end);
    }).join(' ');
    const indexPages = new Map((extra.index?.pages || []).map(p => [p[0], p[2]]));
    const checked = new Set();
    function readPart(part) {
      const source = part.index ? indexPages.get(part.index) : original;
      if (source === undefined) throw Error('Article passage unavailable');
      if (part.crc !== undefined && !checked.has(part.index)) {
        let crc = 0xffffffff;
        for (const byte of new TextEncoder().encode(source)) {
          crc ^= byte;
          for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
        }
        if (((crc ^ 0xffffffff) >>> 0) !== part.crc) throw Error('Article index changed');
        checked.add(part.index);
      }
      let value = source.slice(part.start, part.end);
      for (const [start, end, replacement] of [...(part.patches || [])].reverse()) value = value.slice(0, start) + replacement + value.slice(end);
      return value + (part.suffix || '');
    }
    const text = article.flow.recipe ? article.flow.recipe.map(readPart).join('') : original;
    if (text.length !== article.flow.length) throw Error('Article layout changed');
    const removed = new Set(article.flow.remove || []);
    function clean(start, end) {
      let value = '';
      for (let i = start; i < end; i++) if (!removed.has(i)) value += text[i];
      return value.replace(/\s*-\s*/g, '-').replace(/\s+/g, ' ');
    }
    const cuts = article.flow.pageCuts;
    const documents = [pages, ...(extra.documents || []).map(d => [...d.querySelectorAll('page')].map(lines))];
    function appendGroup(group, ref) {
    const caption = document.createDocumentFragment();
    if (group.caption) {
      let value;
      if (group.caption.parts) value = group.caption.parts.map(readPart).join('');
      else if (group.caption.index) value = indexPages.get(group.caption.index)?.slice(group.caption.start, group.caption.end);
      else value = documents[group.caption.document || 0]?.[group.caption.page]?.join(' ');
      if (value === undefined) throw Error('Gallery caption unavailable');
      for (const [from, to] of Object.entries(group.caption.replacements || {})) value = value.split(from).join(to);
      caption.append(document.createTextNode(value.replace(/\s*-\s*/g, '-').replace(/\s+/g, ' ').trim()));
    }
    const item = mark(figure(group.images, caption), ref);
    item.dataset.galleryPage = group.ref; prose.append(item);
    }
    article.flow.blocks.forEach((block, number) => {
      const blockRef = cuts.findLast(c => c.at <= block.start)?.ref || article.startRef;
      if (block.title) { const heading = document.createElement('h2'); heading.textContent = block.title; prose.append(mark(heading, blockRef)); }
      for (const group of article.galleries.filter(g => g.before === number)) appendGroup(group, blockRef);
      const p = document.createElement(block.heading ? 'h2' : 'p'); p.dataset.paragraph = String(number);
      if (block.credit) p.className = 'article-credit';
      const points = [block.start, ...cuts.filter(c => c.at > block.start && c.at < block.end).map(c => c.at), block.end];
      for (let i = 0; i < points.length - 1; i++) {
        const start = points[i], end = points[i + 1];
        const ref = cuts.findLast(c => c.at <= start)?.ref || article.startRef;
        const span = document.createElement('span'); span.textContent = clean(start, end); p.append(mark(span, ref));
      }
      if (block.speaker) {
        const span = p.firstElementChild, value = span.textContent;
        const strong = document.createElement('strong'); strong.textContent = value.slice(0, block.speaker);
        span.replaceChildren(strong, document.createTextNode(value.slice(block.speaker)));
      }
      prose.append(p);
      for (const group of article.galleries.filter(g => g.after === number)) appendGroup(group, p.lastElementChild.dataset.articlePage);
    });
  }
  window.CinefexInteractiveContent = { render };
})();
