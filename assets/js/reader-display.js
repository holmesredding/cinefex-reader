(() => {
  'use strict';
  const marker = 'cinefexHiddenControls';
  const host = document.querySelector('#reader[name="cinefex-session"]');
  const cleanState = () => { const state = { ...history.state }; delete state[marker]; return state; };
  if (host) {
    let active = false, restoring = false, savedURL = location.href;
    window.CinefexDisplayHistory = {
      get restoring() { return restoring; },
      accepts: route => !restoring || route === decodeURIComponent(new URL(savedURL).hash.slice(1))
    };
    addEventListener('message', event => {
      if (event.source !== host.contentWindow) return;
      const message = event.data || {};
      if (message.cinefexControls === 'hide' && !active) {
        savedURL = location.href; active = true;
        history.pushState({ ...history.state, [marker]: true }, '', savedURL);
      } else if (message.cinefexControls === 'show' && active) history.back();
      else if (message.cinefexControls === 'restored') restoring = false;
      else if (message.cinefexRoute && active) savedURL = location.href;
    });
    addEventListener('popstate', event => {
      if (!active) return;
      event.stopImmediatePropagation(); active = false; restoring = true;
      history.replaceState(cleanState(), '', savedURL);
      host.contentWindow.postMessage({ cinefexControls: 'restore' }, '*');
    }, true);
    return;
  }
  const reader = window.CinefexReader;
  if (!reader) return;
  const inSession = parent !== window && window.name === 'cinefex-session';
  const viewport = document.getElementById('viewport');
  const panel = document.getElementById('articleReading');
  let active = false, leaving = false, savedURL = location.href;
  const button = document.createElement('button');
  button.id = 'hideControlsButton'; button.type = 'button'; button.textContent = 'Hide controls';
  button.setAttribute('aria-controls', 'sidebar viewport');
  document.getElementById('helpButton').before(button);
  const toolbarButton = document.createElement('button');
  toolbarButton.id = 'hideControlsToolbar'; toolbarButton.type = 'button'; toolbarButton.className = 'tool';
  toolbarButton.title = 'Hide controls'; toolbarButton.setAttribute('aria-label', 'Hide controls');
  toolbarButton.setAttribute('aria-controls', 'sidebar viewport');
  toolbarButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 3h16M4 21h16M8 8l4-4 4 4M8 16l4 4 4-4"/></svg><span>Hide controls</span>';
  document.querySelector('.reading-heading').append(toolbarButton);
  const show = document.createElement('button');
  show.id = 'showControlsButton'; show.type = 'button'; show.textContent = 'Show controls'; show.hidden = true;
  viewport.before(show);
  viewport.tabIndex = 0;
  const hint = document.createElement('div');
  hint.className = 'display-hint'; hint.setAttribute('role', 'status'); document.body.append(hint);
  let hintTimer;
  function visible(value) {
    window.CinefexReadingView?.preservePosition();
    document.body.classList.toggle('controls-hidden', !value);
    show.hidden = value;
    if (!value) {
      document.body.classList.remove('contents-open');
      document.getElementById('contentsButton').setAttribute('aria-expanded', 'false');
      (panel && !panel.hidden ? panel : viewport).focus({ preventScroll: true });
      hint.textContent = 'Use Show controls to return. You can also tap the middle or press Escape.';
      hint.classList.add('visible'); clearTimeout(hintTimer);
      hintTimer = setTimeout(() => hint.classList.remove('visible'), 2800);
    } else {
      hint.classList.remove('visible'); clearTimeout(hintTimer);
      const expanded = innerWidth > 1100 && !document.body.classList.contains('focus');
      document.getElementById('contentsButton').setAttribute('aria-expanded', String(expanded));
      toolbarButton.focus({ preventScroll: true });
    }
  }
  function hide() {
    if (active) return;
    active = true; leaving = false; savedURL = location.href;
    if (inSession) parent.postMessage({ cinefexControls: 'hide' }, '*');
    else history.pushState({ ...history.state, [marker]: true }, '', savedURL);
    visible(false);
  }
  function restore() {
    if (!active || leaving || document.querySelector('dialog[open]')) return false;
    leaving = true;
    if (inSession) parent.postMessage({ cinefexControls: 'show' }, '*');
    else history.back();
    return true;
  }
  function restored() {
    history.replaceState(cleanState(), '', savedURL);
    active = false; leaving = false; visible(true);
  }
  function key(event) {
    if (event.key !== 'Escape' || !restore()) return false;
    event.preventDefault?.(); event.stopImmediatePropagation?.(); return true;
  }
  window.CinefexDisplay = {
    get hidden() { return active; }, hide, restore, key,
    ignoreHistory: () => active
  };
  button.onclick = hide; toolbarButton.onclick = hide; show.onclick = restore;
  addEventListener('keydown', key, true);
  addEventListener('cinefexpagechange', () => { if (active) savedURL = location.href; });
  addEventListener('popstate', event => {
    if (inSession || !active) return;
    event.stopImmediatePropagation(); restored();
  }, true);
  addEventListener('message', event => {
    if (inSession && event.source === parent && event.data?.cinefexControls === 'restore') {
      restored(); parent.postMessage({ cinefexControls: 'restored' }, '*');
    }
  });
  if (panel) {
    let tap;
    panel.addEventListener('pointerdown', event => {
      tap = active && event.isPrimary && event.button === 0 && !event.target.closest('a,button,input,select,textarea,video') ? { id: event.pointerId, x: event.clientX, y: event.clientY, time: performance.now(), top: panel.scrollTop } : null;
    });
    panel.addEventListener('pointermove', event => { if (tap && Math.hypot(event.clientX - tap.x, event.clientY - tap.y) > 8) tap = null; });
    panel.addEventListener('pointercancel', () => { tap = null; });
    panel.addEventListener('pointerup', event => {
      const first = tap; tap = null;
      if (!first || event.pointerId !== first.id || performance.now() - first.time > 400 || Math.abs(panel.scrollTop - first.top) > 2 || getSelection()?.toString()) return;
      const rect = panel.getBoundingClientRect(), fraction = (event.clientX - rect.left) / rect.width;
      if (fraction >= .25 && fraction <= .75) restore();
    });
  }
  const term = document.createElement('dt'), explanation = document.createElement('dd');
  term.textContent = 'Hide controls';
  explanation.innerHTML = 'Choose <strong>Hide controls</strong> above the page or in <strong>Contents</strong> to fill the window with the page. Tap <strong>Show controls</strong>, or use <strong>Escape</strong> or your browser’s <strong>Back</strong> button to bring the controls back. On a touch screen, you can also <strong>tap the middle</strong>.';
  document.querySelector('#help dl').append(term, explanation);
})();
