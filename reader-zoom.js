(() => {
  'use strict';
  function create({ viewport, paper, button, width, height, getFrame, turn, blocked }) {
    let chosen = null, scale = 1, fitScale = 1, gesture = null, mouseDrag = null, suppressClickUntil = 0;
    const menu = document.createElement('dialog');
    menu.id = 'pageZoom'; menu.setAttribute('aria-labelledby', 'pageZoomTitle');
    menu.innerHTML = `<div class="dialoghead"><h2 id="pageZoomTitle">Page zoom</h2><button type="button" class="icon-button" aria-label="Close zoom options">×</button></div><div class="zoom-presets"><button type="button" data-zoom="fit">Fit</button><button type="button" data-zoom="1">100%</button><button type="button" data-zoom="1.5">150%</button><button type="button" data-zoom="2">200%</button><button type="button" data-zoom="3">300%</button></div><label class="zoom-slider-label" for="pageZoomRange">Zoom level <output id="pageZoomValue"></output></label><input id="pageZoomRange" type="range" step="1" aria-label="Page zoom percentage">`;
    document.body.append(menu);
    const slider = menu.querySelector('input'), output = menu.querySelector('output');
    const zoomed = () => scale > fitScale + .005;
    const limit = () => Math.max(3, fitScale * 3);
    function syncFrame() {
      getFrame().contentWindow?.postMessage({ cinefexPanMode: { zoomed: zoomed(), dragging: !!mouseDrag } }, '*');
    }
    function sync() {
      const label = chosen === null ? 'Fit' : Math.round(scale * 100) + '%';
      button.textContent = label; button.title = 'Page zoom'; button.setAttribute('aria-label', 'Page zoom, ' + label);
      button.removeAttribute('aria-pressed'); button.setAttribute('aria-haspopup', 'dialog'); button.setAttribute('aria-controls', menu.id);
      slider.min = Math.floor(Math.min(fitScale, 1) * 100); slider.max = Math.ceil(limit() * 100); slider.value = Math.round(scale * 100);
      output.textContent = Math.round(scale * 100) + '%'; slider.setAttribute('aria-valuetext', output.textContent);
      for (const b of menu.querySelectorAll('[data-zoom]')) b.setAttribute('aria-pressed', String(b.dataset.zoom === 'fit' ? chosen === null : chosen !== null && Math.abs(chosen - Number(b.dataset.zoom)) < .005));
      viewport.classList.toggle('page-zoomed', zoomed());
      if (mouseDrag && (!zoomed() || mouseDrag.frame !== getFrame())) stopMouse();
      syncFrame();
    }
    function fit() {
      const style = getComputedStyle(viewport);
      const w = viewport.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const h = viewport.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      fitScale = Math.max(.05, Math.min(w / width, h / height));
      scale = chosen === null ? fitScale : Math.max(Math.min(fitScale, 1), Math.min(chosen, limit()));
      if (chosen !== null) chosen = scale;
      paper.style.width = width * scale + 'px'; paper.style.height = height * scale + 'px';
      getFrame().style.transform = `scale(${scale})`;
      sync();
    }
    const center = () => { const r = viewport.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
    const contentPoint = p => { const r = paper.getBoundingClientRect(); return { x: (p.x - r.left) / scale, y: (p.y - r.top) / scale }; };
    function setScale(value, at = center(), anchor = contentPoint(at)) {
      chosen = value === null ? null : Math.max(Math.min(fitScale, 1), Math.min(value, limit()));
      fit();
      const r = paper.getBoundingClientRect();
      viewport.scrollLeft += r.left + anchor.x * scale - at.x;
      viewport.scrollTop += r.top + anchor.y * scale - at.y;
    }
    function resetPan() { gesture = null; stopMouse(); viewport.scrollLeft = 0; viewport.scrollTop = 0; }
    button.onclick = () => { fit(); menu.showModal(); };
    menu.querySelector('.icon-button').onclick = () => menu.close();
    menu.addEventListener('close', () => button.focus());
    for (const b of menu.querySelectorAll('[data-zoom]')) b.onclick = () => { setScale(b.dataset.zoom === 'fit' ? null : Number(b.dataset.zoom)); menu.close(); };
    slider.oninput = () => setScale(Number(slider.value) / 100);
    const midpoint = points => ({ x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 });
    const distance = points => Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
    function stopMouse() {
      const drag = mouseDrag; mouseDrag = null;
      viewport.classList.remove('page-panning');
      if (drag?.fromPage) drag.frame.contentWindow?.postMessage({ cinefexPanCancel: true }, '*');
      else if (drag && viewport.hasPointerCapture(drag.id)) viewport.releasePointerCapture(drag.id);
      if (drag) syncFrame();
    }
    function mouse(event, fromPage = false) {
      if (event.type === 'pointerdown') {
        if (mouseDrag || event.pointerType !== 'mouse' || event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || !zoomed() || blocked()) return false;
        gesture = null;
        mouseDrag = { id: event.pointerId, x: event.screenX, y: event.screenY, left: viewport.scrollLeft, top: viewport.scrollTop, frame: getFrame(), fromPage, moved: false };
        viewport.classList.add('page-panning'); syncFrame();
        return true;
      }
      const drag = mouseDrag;
      if (!drag || event.pointerId !== drag.id || fromPage !== drag.fromPage) return false;
      if (blocked() || drag.frame !== getFrame() || event.type === 'pointercancel' || event.type === 'lostpointercapture' || (event.type === 'pointermove' && !(event.buttons & 1))) { stopMouse(); return false; }
      const dx = event.screenX - drag.x, dy = event.screenY - drag.y;
      if (Math.hypot(dx, dy) > 4) drag.moved = true;
      if (drag.moved) {
        viewport.scrollLeft = drag.left - dx;
        viewport.scrollTop = drag.top - dy;
        suppressClickUntil = performance.now() + 700;
      }
      if (event.type === 'pointerup') stopMouse();
      return true;
    }
    viewport.addEventListener('pointerdown', event => {
      if (event.target.closest('input,select,textarea,video,button,a,[contenteditable]:not([contenteditable=false])')) return;
      if (mouse(event)) { event.preventDefault(); viewport.setPointerCapture(event.pointerId); }
    });
    for (const type of ['pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']) viewport.addEventListener(type, event => {
      if (mouse(event)) event.preventDefault();
    });
    addEventListener('blur', () => { if (!document.hasFocus()) stopMouse(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) stopMouse(); });
    function input(event, fromPage = false) {
      if (event.type === 'touchstart') stopMouse();
      if (blocked() || event.type === 'touchcancel') { gesture = null; return; }
      if (!Array.isArray(event.points) || event.points.length > 2) { gesture = null; return; }
      if (!gesture) {
        if (event.type !== 'touchstart' || !event.points.length) return;
        const p = event.points[0], r = fromPage ? getFrame().getBoundingClientRect() : null;
        const x = fromPage ? r.left + p.cx * scale : p.cx, y = fromPage ? r.top + p.cy * scale : p.cy;
        gesture = { offset: { x: x - p.x, y: y - p.y }, started: performance.now(), interactive: event.interactive, wasZoomed: zoomed(), mode: 'start', moved: false };
      }
      const g = gesture;
      const points = event.points.map(p => ({ x: p.x + g.offset.x, y: p.y + g.offset.y }));
      const ended = event.changed?.[0];
      const last = points[0] || (ended && { x: ended.x + g.offset.x, y: ended.y + g.offset.y }) || g.last;
      if (points.length === 2) {
        const middle = midpoint(points);
        if (g.mode !== 'pinch') {
          g.mode = 'pinch'; g.startDistance = Math.max(1, distance(points)); g.startScale = scale; g.anchor = contentPoint(middle); g.pinched = true;
        } else {
          const next = Math.max(fitScale, Math.min(limit(), g.startScale * distance(points) / g.startDistance));
          setScale(next <= fitScale * 1.005 ? null : next, middle, g.anchor);
        }
        g.moved = true; suppressClickUntil = performance.now() + 700; return;
      }
      if (points.length === 1) {
        if (g.mode === 'start' || g.mode === 'pinch') {
          g.mode = 'pan'; g.first = points[0]; g.last = points[0]; g.left = viewport.scrollLeft; g.top = viewport.scrollTop;
        }
        const dx = points[0].x - g.first.x, dy = points[0].y - g.first.y;
        if (Math.hypot(dx, dy) > 8) { g.moved = true; suppressClickUntil = performance.now() + 700; }
        if (zoomed()) { viewport.scrollLeft = g.left - dx; viewport.scrollTop = g.top - dy; }
        g.last = points[0]; return;
      }
      gesture = null;
      if (!last || !g.first || g.pinched || g.wasZoomed || zoomed() || (window.visualViewport?.scale || 1) > 1.01) return;
      const dx = last.x - g.first.x, dy = last.y - g.first.y;
      if (performance.now() - g.started < 1000 && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        suppressClickUntil = performance.now() + 700; turn(dx < 0 ? 1 : -1);
      } else if (!g.moved && !g.interactive && performance.now() - g.started < 400) {
        const r = paper.getBoundingClientRect(), fraction = (last.x - r.left) / r.width;
        if (last.y >= r.top && last.y <= r.bottom && fraction >= 0 && fraction <= 1 && (fraction < .25 || fraction > .75)) {
          suppressClickUntil = performance.now() + 700; turn(fraction < .25 ? -1 : 1);
        }
      }
    }
    const points = list => [...list].map(p => ({ x: p.screenX, y: p.screenY, cx: p.clientX, cy: p.clientY }));
    for (const type of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) viewport.addEventListener(type, e => {
      if (e.target.closest('input,select,textarea,video,button,[contenteditable]:not([contenteditable=false])')) return;
      if (type === 'touchmove' || e.touches.length > 1) e.preventDefault();
      input({ type, points: points(e.touches), changed: points(e.changedTouches), interactive: !!e.target.closest('a,area') });
    }, { passive: false });
    viewport.addEventListener('click', e => { if (performance.now() < suppressClickUntil) { e.preventDefault(); e.stopImmediatePropagation(); } }, true);
    for (const type of ['gesturestart', 'gesturechange']) viewport.addEventListener(type, e => e.preventDefault(), { passive: false });
    function pinchWheel(e, fromPage = false) {
      if (!e.ctrlKey || e.metaKey || e.altKey || blocked()) return false;
      const r = fromPage ? getFrame().getBoundingClientRect() : null;
      const at = fromPage ? { x: r.left + e.clientX * scale, y: r.top + e.clientY * scale } : { x: e.clientX, y: e.clientY };
      const next = Math.max(fitScale, Math.min(limit(), scale * Math.exp(-e.deltaY * .01)));
      setScale(next <= fitScale * 1.005 ? null : next, at); e.preventDefault?.(); return true;
    }
    return { fit, resetPan, input, mouse, syncFrame, pinchWheel, zoomed, blocksClick: () => performance.now() < suppressClickUntil };
  }
  window.CinefexPageZoom = { create };
})();
