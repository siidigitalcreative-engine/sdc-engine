import "server-only";

import { BlobPreconditionFailedError, get, put } from "@vercel/blob";

const PATHNAME = "sdc/lockers.json";

/* A locker is one ad, laid out on a canvas: images, videos and notes placed
   where you want them, rather than rows in a table. */

const ITEM_KINDS = ["image", "video", "note"];

const clean = (v, max = 160) => String(v ?? "").trim().replace(/\s+/g, " ").slice(0, max);
const num = (v, fallback, min, max) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
};
const newId = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
const newToken = () =>
  `${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

function normalizeItem(item) {
  const kind = ITEM_KINDS.includes(item?.kind) ? item.kind : "image";
  return {
    id: clean(item?.id, 60) || newId("it"),
    kind,
    url: kind === "note" ? "" : clean(item?.url, 600),
    name: clean(item?.name, 140),
    // notes carry their text; media carry a caption in `name`
    text: kind === "note" ? String(item?.text ?? "").slice(0, 2000) : "",
    x: num(item?.x, 44, 0, 6000),
    y: num(item?.y, 44, 0, 6000),
    w: num(item?.w, 230, 120, 1600),
    h: num(item?.h, kind === "note" ? 150 : 230, 90, 1600),
  };
}

function normalizeLocker(locker) {
  const items = (Array.isArray(locker?.items) ? locker.items : [])
    .map(normalizeItem)
    .filter((i) => i.kind === "note" || i.url || i.name)
    .slice(0, 120);

  return {
    id: clean(locker?.id, 60) || newId("lk"),
    name: clean(locker?.name, 120) || "Untitled locker",
    brand: clean(locker?.brand, 80),
    items,
    /* Its own read-only link. The token is the whole credential, so it is long
       and random, and turning sharing off keeps it: switching back on restores
       the same link rather than breaking one already sent. */
    share: {
      enabled: Boolean(locker?.share?.enabled),
      token: clean(locker?.share?.token, 60) || newToken(),
    },
    department: clean(locker?.department, 60) || "sdc",
    createdBy: clean(locker?.createdBy, 60),
    updatedAt: locker?.updatedAt || new Date().toISOString(),
  };
}

function normalizeState(raw) {
  const seen = new Set();
  const lockers = (Array.isArray(raw?.lockers) ? raw.lockers : [])
    .map(normalizeLocker)
    .filter((l) => (seen.has(l.id) ? false : seen.add(l.id)));
  return { version: 1, updatedAt: raw?.updatedAt || new Date().toISOString(), lockers };
}

const WRITE_OPTS = {
  access: "private",
  contentType: "application/json",
  allowOverwrite: true,
  addRandomSuffix: false,
  cacheControlMaxAge: 0,
};

function isEtagConflict(error) {
  return error instanceof BlobPreconditionFailedError ||
    error?.name === "BlobPreconditionFailedError" ||
    /precondition failed|etag mismatch/i.test(String(error?.message || ""));
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function readLockers() {
  const result = await get(PATHNAME, { access: "private", useCache: false, cacheControlMaxAge: 0 });
  if (!result?.stream) {
    const state = normalizeState({ lockers: [] });
    const blob = await put(PATHNAME, JSON.stringify(state), WRITE_OPTS);
    return { state, etag: blob.etag };
  }
  const text = await new Response(result.stream).text();
  try {
    return { state: normalizeState(JSON.parse(text)), etag: result.blob.etag };
  } catch {
    return { state: normalizeState({ lockers: [] }), etag: result.blob.etag };
  }
}

async function mutate(mutator) {
  let lastError;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const current = await readLockers();
    const next = normalizeState({
      lockers: await mutator(current.state.lockers.map((l) => ({ ...l, items: [...l.items] }))),
      updatedAt: new Date().toISOString(),
    });
    try {
      await put(PATHNAME, JSON.stringify(next), { ...WRITE_OPTS, ifMatch: current.etag });
      return next;
    } catch (error) {
      if (!isEtagConflict(error)) throw error;
      lastError = error;
      await wait(25 * (attempt + 1));
    }
  }
  const latest = await readLockers();
  const finalState = normalizeState({
    lockers: await mutator(latest.state.lockers.map((l) => ({ ...l, items: [...l.items] }))),
    updatedAt: new Date().toISOString(),
  });
  try {
    await put(PATHNAME, JSON.stringify(finalState), WRITE_OPTS);
    return finalState;
  } catch (error) {
    throw lastError || error;
  }
}

export async function addLocker(data) {
  const draft = normalizeLocker({ ...data, updatedAt: new Date().toISOString() });
  return mutate((lockers) => [draft, ...lockers]);
}

export async function updateLocker(id, patch) {
  const target = clean(id, 60);
  return mutate((lockers) => {
    const found = lockers.find((l) => l.id === target);
    if (!found) throw new Error("That locker no longer exists.");
    const merged = normalizeLocker({ ...found, ...patch, id: target, updatedAt: new Date().toISOString() });
    return lockers.map((l) => (l.id === target ? merged : l));
  });
}

export async function removeLocker(id) {
  const target = clean(id, 60);
  return mutate((lockers) => lockers.filter((l) => l.id !== target));
}

/* The board behind a public link: only a shared locker, and only what a
   viewer needs to see it. */
export async function getSharedLocker(token) {
  const wanted = clean(token, 60);
  if (!wanted) return null;

  const { state } = await readLockers();
  const found = state.lockers.find((l) => l.share?.enabled && l.share.token === wanted);
  if (!found) return null;

  return {
    name: found.name,
    brand: found.brand,
    items: found.items,
    updatedAt: found.updatedAt,
  };
}
