(() => {
  'use strict';
  const table = Uint32Array.from({ length: 256 }, (_, n) => {
    for (let i = 0; i < 8; i++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
    return n >>> 0;
  });
  function check(signal) {
    if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
  }
  function wait(ms, signal) {
    check(signal);
    return new Promise((resolve, reject) => {
      const finish = () => { signal.removeEventListener('abort', abort); resolve(); };
      const timer = setTimeout(finish, ms);
      const abort = () => { clearTimeout(timer); reject(new DOMException('Cancelled', 'AbortError')); };
      signal.addEventListener('abort', abort, { once: true });
    });
  }
  function create() {
    const files = new Map();
    let issue;
    async function prepare(data, signal, progress = () => {}) {
      check(signal);
      if (issue !== data.issue) { files.clear(); issue = data.issue; }
      const total = data.assets.length;
      let done = data.assets.filter(url => files.has(url)).length;
      let bytes = data.assets.reduce((sum, url) => sum + (files.get(url)?.size || 0), 0);
      const report = retry => progress({ done, total, bytes, retry });
      report();
      const pending = data.assets.filter(url => !files.has(url));
      const controller = new AbortController();
      const abort = () => controller.abort();
      signal.addEventListener('abort', abort, { once: true });
      let cursor = 0, failure;
      async function download(url) {
        const expected = data.metadata[url];
        if (!url.startsWith('https://archive.org/download/') || !expected) {
          throw Error('This issue needs files from a local folder.');
        }
        let delay = 1500;
        for (let attempt = 0; attempt < 3; attempt++) {
          check(controller.signal);
          const request = new AbortController();
          const cancel = () => request.abort();
          controller.signal.addEventListener('abort', cancel, { once: true });
          const timer = setTimeout(cancel, 60000);
          let permanent = false;
          try {
            const response = await fetch(url, { signal: request.signal, credentials: 'omit' });
            if (!response.ok) {
              permanent = response.status >= 400 && response.status < 500 && ![408, 429].includes(response.status);
              const retryAfter = response.headers.get('Retry-After');
              if (retryAfter) {
                const seconds = Number(retryAfter);
                const ms = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(retryAfter) - Date.now();
                if (Number.isFinite(ms)) delay = Math.min(60000, Math.max(delay, ms));
              }
              throw Error('Download failed');
            }
            const value = new Uint8Array(await response.arrayBuffer());
            check(controller.signal);
            let crc = 0xffffffff;
            for (const byte of value) crc = table[(crc ^ byte) & 255] ^ (crc >>> 8);
            if (value.length !== expected.size || ((crc ^ 0xffffffff) >>> 0) !== expected.crc) throw Error('Incomplete image');
            const type = value[0] === 0x89 ? 'image/png' : value[0] === 0xff ? 'image/jpeg' : 'application/octet-stream';
            return new Blob([value], { type });
          } catch (error) {
            check(controller.signal);
            if (permanent || attempt === 2) {
              throw Error('Archive.org could not provide all the images. Try again to resume, or use a local folder.');
            }
          } finally {
            clearTimeout(timer);
            controller.signal.removeEventListener('abort', cancel);
          }
          report(true);
          await wait(delay, controller.signal);
          delay = Math.min(60000, delay * 2);
        }
      }
      async function worker() {
        try {
          while (cursor < pending.length) {
            check(controller.signal);
            const url = pending[cursor++];
            const blob = await download(url);
            check(controller.signal);
            files.set(url, blob); done++; bytes += blob.size; report();
          }
        } catch (error) {
          failure ||= error;
          controller.abort();
        }
      }
      try {
        await Promise.all([worker(), worker()]);
        check(signal);
        if (failure) throw failure;
      } finally { signal.removeEventListener('abort', abort); }
    }
    return {
      prepare,
      resolve: async url => files.get(url) || null,
      get count() { return files.size; },
      clear: () => files.clear()
    };
  }
  window.CinefexPDFArchive = { create };
})();
