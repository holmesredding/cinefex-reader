(() => {
  'use strict';
  function render(article, prose, figure, mark, data) {
    const pages = new Map((data?.pages || []).map(page => [page[0], page[2]]));
    for (const [ref, expected] of Object.entries(article.indexCrc)) {
      const text = pages.get(ref);
      if (text === undefined) throw Error('Article page unavailable');
      let crc = 0xffffffff;
      for (const byte of new TextEncoder().encode(text)) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
      }
      if (((crc ^ 0xffffffff) >>> 0) !== expected) throw Error('Article index changed');
    }
    function text(part) {
      let value = pages.get(part.index).slice(part.start, part.end);
      for (const [start, end, replacement] of [...(part.patches || [])].reverse()) value = value.slice(0, start) + replacement + value.slice(end);
      return part.dropEnd ? value.slice(0, -part.dropEnd) : value;
    }
    for (const block of article.blocks) {
      const content = document.createDocumentFragment();
      block.parts.forEach((part, i) => {
        const span = document.createElement('span');
        const value = (i && part.join !== '' ? ' ' : '') + text(part);
        if (!i && block.speaker) {
          const name = document.createElement('strong'); name.textContent = value.slice(0, block.speaker);
          span.append(name, document.createTextNode(value.slice(block.speaker)));
        } else span.textContent = value;
        content.append(block.type === 'figure' ? span : mark(span, part.index));
      });
      if (block.type === 'figure') {
        prose.append(mark(figure(block.images, content), block.ref));
      } else {
        const paragraph = document.createElement(block.type === 'h2' ? 'h2' : 'p');
        if (block.credit) paragraph.className = 'article-credit';
        if (block.caption) paragraph.className = 'article-caption';
        if (block.question) paragraph.className = 'article-question';
        paragraph.append(content); prose.append(paragraph);
      }
    }
  }
  window.CinefexIndexedContent = { render };
})();
