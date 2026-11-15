(() => {
  'use strict';
  const key = 'cinefex-default-reading-view';
  const valid = value => value === 'page' || value === 'text';
  const inSession = parent !== window && window.name === 'cinefex-session';
  let choice = 'page';
  try { const stored = localStorage.getItem(key); if (valid(stored)) choice = stored; } catch {}
  function parentPreference() {
    try { if (inSession) return parent.CinefexViewPreference; } catch {}
  }
  if (parentPreference()) choice = parentPreference().get();
  function notify(apply = false, initial = false) {
    const detail = { value: choice, apply, initial };
    dispatchEvent(new CustomEvent('cinefexviewpreferencechange', { detail }));
    document.querySelector('#reader[name="cinefex-session"]')?.contentWindow.postMessage({ cinefexViewPreference: detail }, '*');
  }
  function set(value) {
    if (!valid(value)) return;
    if (inSession) {
      const owner = parentPreference();
      if (owner) owner.set(value);
      else parent.postMessage({ cinefexSetViewPreference: value }, '*');
      return;
    }
    choice = value;
    try { localStorage.setItem(key, choice); } catch {}
    notify(true);
  }
  window.CinefexViewPreference = { get: () => choice, set };
  addEventListener('storage', event => {
    if (event.key !== key && event.key !== null) return;
    choice = valid(event.newValue) ? event.newValue : 'page';
    notify();
  });
  addEventListener('message', event => {
    if (inSession && event.source === parent && valid(event.data?.cinefexViewPreference?.value)) {
      const detail = event.data.cinefexViewPreference;
      choice = detail.value; notify(detail.apply, detail.initial);
      return;
    }
    const frame = document.querySelector('#reader[name="cinefex-session"]');
    if (!frame || event.source !== frame.contentWindow) return;
    if (event.data?.cinefexViewPreferenceRequest) {
      frame.contentWindow.postMessage({ cinefexViewPreference: { value: choice, apply: false, initial: true } }, '*');
    } else if (valid(event.data?.cinefexSetViewPreference)) set(event.data.cinefexSetViewPreference);
  });
  if (inSession) parent.postMessage({ cinefexViewPreferenceRequest: true }, '*');
})();
