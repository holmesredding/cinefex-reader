(() => {
  'use strict';
  const base = new URL('../data/search/', document.currentScript.src);
  const cache = new Map(), pending = new WeakMap();
  function load(key) {
    if (!/^(meta|words\/[a-z0-9]{2}|text\/\d{1,3})$/.test(key)) return Promise.reject(Error('Invalid search file'));
    if (cache.has(key)) return cache.get(key);
    const job = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      let received = false, value;
      const finish = error => {
        clearTimeout(timer);
        pending.delete(script);
        script.remove();
        if (error) reject(error);
        else resolve(value);
      };
      const timer = setTimeout(() => finish(Error('Search file timed out')), 30000);
      pending.set(script, {key, receive(data) { value = data; received = true; }});
      script.onload = () => finish(received ? null : Error('Search file is incomplete'));
      script.onerror = () => finish(Error('Search file could not load'));
      script.src = new URL(key + '.js', base).href;
      document.head.append(script);
    });
    cache.set(key, job);
    job.catch(() => { if (cache.get(key) === job) cache.delete(key); });
    return job;
  }
  window.CinefexSearchData = {
    load,
    register(key, data) {
      const request = pending.get(document.currentScript);
      if (request?.key === key) request.receive(data);
    }
  };
})();
