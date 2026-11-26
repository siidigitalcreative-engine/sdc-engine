/* Downloading locker files.

   One file goes straight to the browser's download. Several are bundled into a
   single .zip built right here in the browser, so nothing extra runs on the
   server and the files are never re-encoded. Photos and video are already
   compressed, so the zip simply stores them as they are. */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const EXTENSION = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/avif": "avif",
  "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm",
};

// A name that is safe inside a zip, keeps (or regains) its extension, and is unique.
function entryName(item, contentType, used) {
  let name = String(item.name || "file").replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "-").trim() || "file";
  if (!/\.[A-Za-z0-9]{2,5}$/.test(name)) {
    const ext = EXTENSION[String(contentType || "").split(";")[0].trim().toLowerCase()];
    if (ext) name += `.${ext}`;
  }
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  let candidate = name;
  for (let n = 2; used.has(candidate.toLowerCase()); n += 1) candidate = `${stem} (${n})${ext}`;
  used.add(candidate.toLowerCase());
  return candidate;
}

function dosStamp(date) {
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
    day: ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

// files: [{ name, bytes: Uint8Array }] -> a zip Blob (files stored, not compressed)
export function buildZip(files) {
  const encoder = new TextEncoder();
  const stamp = dosStamp(new Date());
  const parts = [];
  const central = [];
  let offset = 0;

  for (const file of files) {
    const name = encoder.encode(file.name);
    const crc = crc32(file.bytes);
    const size = file.bytes.length;

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true);          // names are UTF-8
    local.setUint16(8, 0, true);               // stored
    local.setUint16(10, stamp.time, true);
    local.setUint16(12, stamp.day, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, size, true);
    local.setUint32(22, size, true);
    local.setUint16(26, name.length, true);
    local.setUint16(28, 0, true);

    parts.push(local.buffer, name, new Blob([file.bytes]));

    const entry = new DataView(new ArrayBuffer(46));
    entry.setUint32(0, 0x02014b50, true);
    entry.setUint16(4, 20, true);
    entry.setUint16(6, 20, true);
    entry.setUint16(8, 0x0800, true);
    entry.setUint16(10, 0, true);
    entry.setUint16(12, stamp.time, true);
    entry.setUint16(14, stamp.day, true);
    entry.setUint32(16, crc, true);
    entry.setUint32(20, size, true);
    entry.setUint32(24, size, true);
    entry.setUint16(28, name.length, true);
    entry.setUint32(42, offset, true);
    central.push(entry.buffer, name);

    offset += 30 + name.length + size;
  }

  const centralSize = central.reduce((total, piece) => total + (piece.byteLength ?? piece.length), 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);

  return new Blob([...parts, ...central, end.buffer], { type: "application/zip" });
}

function save(blobOrUrl, filename) {
  const link = document.createElement("a");
  const isBlob = typeof blobOrUrl !== "string";
  const href = isBlob ? URL.createObjectURL(blobOrUrl) : blobOrUrl;
  link.href = href;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  if (isBlob) setTimeout(() => URL.revokeObjectURL(href), 60000);
}

const fileSafe = (text) => String(text || "locker").replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "-").trim().slice(0, 80) || "locker";

/* items: locker items with { url, name }. Resolves { skipped: [names] }.
   Throws if nothing could be fetched at all. */
/* mode "zip" bundles everything into one archive; mode "files" hands the
   browser each file on its own, which is what people want when the files go
   straight into another tool rather than a folder.

   A single file is always just that file, whichever mode is asked for. */
export async function downloadLockerFiles(items, { zipName = "locker", onProgress, mode = "zip" } = {}) {
  const list = (items || []).filter((item) => item && item.url);
  if (!list.length) throw new Error("There is nothing to download.");

  if (list.length === 1) {
    save(list[0].url, String(list[0].name || "file"));
    return { skipped: [] };
  }

  if (mode === "files") {
    const used = new Set();
    const missed = [];

    for (let index = 0; index < list.length; index += 1) {
      const item = list[index];
      onProgress?.(index, list.length);
      try {
        /* Fetched rather than linked, so each one keeps the name it was given
           here and the browser does not open it in a tab instead. */
        const response = await fetch(item.url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        save(objectUrl, entryName(item, response.headers.get("content-type"), used));
        setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
        // a short gap, or a browser treats a burst as one runaway download
        await new Promise((resolve) => setTimeout(resolve, 350));
      } catch {
        missed.push(String(item.name || "file"));
      }
    }

    onProgress?.(list.length, list.length);
    return { skipped: missed };
  }

  const used = new Set();
  const files = [];
  const skipped = [];

  for (let index = 0; index < list.length; index += 1) {
    const item = list[index];
    onProgress?.(index, list.length);
    try {
      const response = await fetch(item.url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      files.push({ name: entryName(item, response.headers.get("content-type"), used), bytes });
    } catch {
      skipped.push(String(item.name || "file"));
    }
  }

  if (!files.length) throw new Error("None of those files could be downloaded.");
  onProgress?.(list.length, list.length);
  save(buildZip(files), `${fileSafe(zipName)}.zip`);
  return { skipped };
}
