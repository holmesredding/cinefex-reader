(() => {
  'use strict';
  const encoder = new TextEncoder();
  const maximum32 = 0xffffffff;
  const table = Uint32Array.from({ length: 256 }, (_, n) => {
    for (let i = 0; i < 8; i++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
    return n >>> 0;
  });
  const pause = () => new Promise(resolve => setTimeout(resolve, 0));
  function header(length, signature) {
    const bytes = new Uint8Array(length), view = new DataView(bytes.buffer);
    view.setUint32(0, signature, true);
    return { bytes, view };
  }
  async function checksum(bytes, check) {
    let crc = 0xffffffff;
    for (let start = 0; start < bytes.length; start += 1048576) {
      check();
      for (let i = start; i < Math.min(start + 1048576, bytes.length); i++) crc = table[(crc ^ bytes[i]) & 255] ^ (crc >>> 8);
      await pause();
    }
    return (crc ^ 0xffffffff) >>> 0;
  }
  async function create(estimatedBytes, check = () => {}) {
    if (!navigator.storage?.getDirectory) throw Error('This browser cannot save the catalogue as one ZIP. Use Chrome or Edge to save to a folder, or create PDFs one issue at a time.');
    const estimate = await navigator.storage.estimate();
    if (estimate.quota && estimate.quota - estimate.usage < estimatedBytes * 1.1) throw Error('There is not enough temporary storage for this ZIP. Free some space, or use Chrome or Edge to save the PDFs to a folder.');
    check();
    const root = await navigator.storage.getDirectory();
    const directory = await root.getDirectoryHandle('cinefex-pdf-exports', { create: true });
    const name = `catalogue-${Date.now()}-${crypto.randomUUID()}.zip`;
    const handle = await directory.getFileHandle(name, { create: true });
    let stream, closed = false, removed = false, offset = 0;
    const central = [];
    async function dispose() {
      if (removed) return;
      if (stream && !closed) { await stream.abort().catch(() => {}); closed = true; }
      await directory.removeEntry(name).catch(() => {});
      removed = true;
    }
    try {
      if (!handle.createWritable) throw Error('This browser cannot save the catalogue as one ZIP. Use Chrome or Edge, or create PDFs one issue at a time.');
      stream = await handle.createWritable();
      check();
    } catch (error) { await dispose(); throw error; }
    async function write(bytes) {
      for (let start = 0; start < bytes.length; start += 1048576) {
        check();
        const chunk = bytes.slice(start, Math.min(start + 1048576, bytes.length));
        await stream.write(chunk.buffer);
        offset += chunk.length;
      }
    }
    async function rollback(position) {
      try { await stream.truncate(position); await stream.seek(position); offset = position; }
      catch { await dispose(); }
    }
    async function add(name, bytes) {
      check();
      if (closed || removed) throw Error('The ZIP is closed.');
      if (bytes.length >= maximum32) throw Error('This PDF is too large to add to the ZIP.');
      const filename = encoder.encode(name), crc = await checksum(bytes, check);
      const start = offset, largeOffset = start >= maximum32;
      const local = header(30, 0x04034b50), entry = header(46, 0x02014b50);
      const now = new Date(), year = Math.max(1980, Math.min(now.getFullYear(), 2107));
      const date = ((year - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
      const time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
      local.view.setUint16(4, 20, true); local.view.setUint16(6, 0x800, true);
      local.view.setUint16(10, time, true); local.view.setUint16(12, date, true);
      local.view.setUint32(14, crc, true); local.view.setUint32(18, bytes.length, true); local.view.setUint32(22, bytes.length, true);
      local.view.setUint16(26, filename.length, true);
      entry.view.setUint16(4, 45, true); entry.view.setUint16(6, largeOffset ? 45 : 20, true); entry.view.setUint16(8, 0x800, true);
      entry.view.setUint16(12, time, true); entry.view.setUint16(14, date, true);
      entry.view.setUint32(16, crc, true); entry.view.setUint32(20, bytes.length, true); entry.view.setUint32(24, bytes.length, true);
      entry.view.setUint16(28, filename.length, true); entry.view.setUint16(30, largeOffset ? 12 : 0, true);
      entry.view.setUint32(42, largeOffset ? maximum32 : start, true);
      const extra = new Uint8Array(largeOffset ? 12 : 0);
      if (largeOffset) {
        const view = new DataView(extra.buffer);
        view.setUint16(0, 1, true); view.setUint16(2, 8, true); view.setBigUint64(4, BigInt(start), true);
      }
      try {
        await write(local.bytes); await write(filename); await write(bytes);
        central.push([entry.bytes, filename, extra]);
      } catch (error) { await rollback(start); throw error; }
    }
    async function finish() {
      check();
      if (removed) throw Error('The ZIP is closed.');
      if (closed) {
        const file = await handle.getFile();
        if (file.size !== offset) throw Error('The ZIP was not saved completely. Please try again.');
        return file;
      }
      const start = offset;
      try {
      for (const entry of central) for (const bytes of entry) await write(bytes);
      const size = offset - start, count = central.length;
      const large = start >= maximum32 || size >= maximum32 || count >= 65535;
      if (large) {
        const position = offset, end64 = header(56, 0x06064b50), locator = header(20, 0x07064b50);
        end64.view.setBigUint64(4, 44n, true); end64.view.setUint16(12, 45, true); end64.view.setUint16(14, 45, true);
        end64.view.setBigUint64(24, BigInt(count), true); end64.view.setBigUint64(32, BigInt(count), true);
        end64.view.setBigUint64(40, BigInt(size), true); end64.view.setBigUint64(48, BigInt(start), true);
        locator.view.setBigUint64(8, BigInt(position), true); locator.view.setUint32(16, 1, true);
        await write(end64.bytes); await write(locator.bytes);
      }
      const end = header(22, 0x06054b50);
      end.view.setUint16(8, Math.min(count, 65535), true); end.view.setUint16(10, Math.min(count, 65535), true);
      end.view.setUint32(12, Math.min(size, maximum32), true); end.view.setUint32(16, Math.min(start, maximum32), true);
      await write(end.bytes); check(); await stream.close(); closed = true;
      const file = await handle.getFile(); check();
      if (file.size !== offset) throw Error('The ZIP was not saved completely. Please try again.');
      return file;
      } catch (error) { if (!closed) await rollback(start); throw error; }
    }
    return { add, finish, dispose, get usable() { return !removed; } };
  }
  window.CinefexPDFZip = { create };
})();
