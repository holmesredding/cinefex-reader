(() => {
  'use strict';
  const blockTags = new Set(['p', 'li', 'h2', 'h3', 'h4', 'blockquote']);
  const inlineTags = new Set(['em', 'strong', 'b', 'i', 'sup', 'sub', 'br']);
  const normal = text => text.replace(/\s+/g, ' ').trim();
  function render(doc, article, prose, figure, extra) {
    const firstRef = article.startRef || article.refs[0], alias = ref => article.pageAliases?.[ref] || ref;
    let serial = 0;
    const mark = (element, ref) => { element.dataset.articlePage = alias(ref || firstRef); element.dataset.articleAnchor = String(serial++); return element; };
    const header = document.createElement('header'); header.className = 'article-title';
    const h = document.createElement('h1'); h.textContent = article.title; header.append(h);
    let sourceTitle = null, byline = null;
    if (article.format === 'native') {
      sourceTitle = doc.querySelector('articleTitle');
      const next = sourceTitle?.nextElementSibling;
      if (next && /^(?:(?:interview|written|story|text|article|artwork)\s+)?by\b/i.test(normal(next.textContent))) byline = next;
    }
    if (byline || article.author) {
      const author = document.createElement('p'); author.textContent = byline ? normal(byline.textContent) : 'By ' + article.author; header.append(author);
    }
    prose.append(mark(header, firstRef));
    function copy(node, ref, inCaption = false) {
      if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.textContent);
      if (node.nodeType !== Node.ELEMENT_NODE || node === sourceTitle || node === byline) return document.createDocumentFragment();
      const tag = node.localName;
      if (['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'link', 'meta'].includes(tag)) return document.createDocumentFragment();
      if (tag === 'page') ref = alias(node.getAttribute('page-num')) || ref;
      if (tag === 'img' || (node.className.split?.(/\s+/).some(c => c.startsWith('img-group')) && node.querySelector('img'))) {
        const originals = tag === 'img' ? [node] : [...node.querySelectorAll('img')];
        const images = [], seen = new Set();
        for (const image of originals) {
          const item = article.images[image.getAttribute('src')];
          if (!item) throw Error('An article image is unavailable');
          if (!seen.has(item.url)) { images.push(item); seen.add(item.url); }
        }
        const caption = document.createDocumentFragment();
        for (const source of node.querySelectorAll('.caption')) for (const child of source.childNodes) caption.append(copy(child, ref, true));
        return mark(figure(images, caption), ref);
      }
      let result;
      if (inlineTags.has(tag) || blockTags.has(tag) || ['ol', 'ul'].includes(tag)) result = document.createElement(tag);
      else if (tag === 'a' && /^https?:\/\//i.test(node.getAttribute('href') || '')) {
        result = document.createElement('a'); result.href = node.getAttribute('href'); result.target = '_blank'; result.rel = 'noopener noreferrer';
      } else result = document.createElement(['page', 'div'].includes(tag) ? 'div' : 'span');
      if (tag === 'page') result.className = 'article-source-page';
      if (node.classList.contains('footer')) result.className = 'article-credit';
      if (node.classList.contains('caption')) result.className = 'article-caption';
      for (const child of node.childNodes) result.append(copy(child, ref, inCaption));
      if (!inCaption && (blockTags.has(tag) || result.className === 'article-credit')) mark(result, ref);
      return result;
    }
    if (article.format === 'native') {
      for (const child of doc.body.childNodes) prose.append(copy(child, firstRef));
    } else if (article.format === 'indexed') {
      CinefexIndexedContent.render(article, prose, figure, mark, extra.index);
    } else if (article.format === 'interactive') {
      CinefexInteractiveContent.render(doc, article, prose, figure, mark, extra);
    } else {
      let paragraph = null;
      for (let index = 0; index < 27; index++) {
        const ref = '15.' + (index + 1), page = doc.querySelector(`page[page-num="${ref}"]`);
        if (!page) throw Error('Article incomplete');
        const lines = page.textContent.split(/[\r\n]+/).map(s => s.trim()).filter(Boolean);
        const starts = article.paragraphs[index], from = index === 0 ? 3 : 0, end = lines.length - (index === 0 ? 1 : 2);
        if (index === 0 ? lines[0] !== article.title || lines.at(-1) !== 'F' : lines.at(-2) !== 'MANK' || lines.at(-1) !== `${index + 1} / 27`) throw Error('Article format changed');
        const cuts = [...new Set([from, ...starts, end])].sort((a, b) => a - b);
        for (let j = 0; j < cuts.length - 1; j++) {
          const a = cuts[j], b = cuts[j + 1], fresh = starts.includes(a);
          let text = lines.slice(a, b).join(' ').replace(/\s*-\s*/g, '-');
          for (const [before, after] of Object.entries(article.replacements)) text = text.split(before).join(after);
          if (index === 0 && a === 3) text = 'F' + text;
          if (fresh || !paragraph) { paragraph = document.createElement('p'); paragraph.dataset.paragraph = ref + ':' + a; prose.append(paragraph); }
          else if (paragraph.lastElementChild.textContent.endsWith('-')) paragraph.lastElementChild.textContent = paragraph.lastElementChild.textContent.slice(0, -1);
          else text = ' ' + text;
          const span = document.createElement('span'); span.textContent = text; paragraph.append(mark(span, ref));
          if (ref === article.italicParagraph.page && a === article.italicParagraph.start) paragraph.className = 'article-credit';
        }
      }
      for (const group of article.galleries) {
        const after = prose.querySelector(`[data-paragraph="${group.after}"]`);
        const captionPage = doc.querySelector(`page[page-num="${group.caption}"]`);
        if (!after || !captionPage) throw Error('Gallery position unavailable');
        const caption = document.createDocumentFragment(); let text = normal(captionPage.textContent);
        for (const [before, after] of Object.entries(article.captionReplacements || {})) text = text.split(before).join(after);
        caption.append(document.createTextNode(text));
        const item = mark(figure(group.images, caption), after.lastElementChild.dataset.articlePage);
        item.dataset.galleryPage = group.caption;
        let insertion = after;
        while (insertion.nextElementSibling?.dataset.afterParagraph === group.after) insertion = insertion.nextElementSibling;
        item.dataset.afterParagraph = group.after; insertion.after(item);
      }
    }
    // Number anchors after placing the galleries so their order follows the article.
    [...prose.querySelectorAll('[data-article-anchor]')].forEach((e, i) => e.dataset.articleAnchor = String(i));
    const end = document.createElement('div'); end.className = 'article-end'; prose.append(end);
  }
  window.CinefexArticleContent = { render };
})();
