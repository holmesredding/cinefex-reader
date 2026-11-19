(() => {
  'use strict';
  const root = document.documentElement;
  const inSession = parent !== window && window.name === 'cinefex-session';
  root.classList.toggle('reader-in-session', inSession);
  // Only the outer document owns Safari's visual viewport and safe area.
  // Nested 100dvh layouts can otherwise retain the pre-full-screen height.
  if (inSession) return;
  let pending;
  function update() {
    pending = 0;
    const viewport = window.visualViewport;
    // Browser pinch zoom must not resize/reflow the document under the gesture.
    if (viewport && Math.abs(viewport.scale - 1) > .01) return;
    window.CinefexReadingView?.preservePosition();
    root.style.setProperty('--reader-height', (viewport?.height || innerHeight) + 'px');
  }
  const schedule = () => { if (!pending) pending = requestAnimationFrame(update); };
  addEventListener('resize', schedule);
  addEventListener('pageshow', schedule);
  document.addEventListener('fullscreenchange', schedule);
  document.addEventListener('webkitfullscreenchange', schedule);
  window.visualViewport?.addEventListener('resize', schedule);
  update();
})();
