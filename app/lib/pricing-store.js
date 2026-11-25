import "server-only";

import { BlobPreconditionFailedError, get, put } from "@vercel/blob";

const PATHNAME = "sdc/pricing.json";

/* A pricing sheet: products grouped by brand, each with its quantity tiers.
   One sheet per price list, with its own read-only link. */

const clean = (v, max = 160) => String(v ?? "").trim().replace(/\s+/g, " ").slice(0, max);
const newId = (p) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
const newToken = () =>
  `${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

function normalizeTier(tier) {
  return {
    id: clean(tier?.id, 60) || newId("tr"),
    pieces: clean(tier?.pieces, 40),            // "1-10pcs", "101pcs-above"
    price: clean(tier?.price, 40),              // kept as text: ranges and notes are common
    note: clean(tier?.note, 80),
  };
}

function normalizeRow(row) {
  const tiers = (Array.isArray(row?.tiers) ? row.tiers : []).map(normalizeTier).slice(0, 20);
  return {
    id: clean(row?.id, 60) || newId("rw"),
    brand: clean(row?.brand, 80),
    product: clean(row?.product, 120),
    tiers: tiers.length ? tiers : [normalizeTier({})],
  };
}

function normalizeSheet(sheet) {
  const rows = (Array.isArray(sheet?.rows) ? sheet.rows : []).map(normalizeRow).slice(0, 200);
  return {
    id: clean(sheet?.id, 60) || newId("pr"),
    name: clean(sheet?.name, 120) || "Untitled price list",
    note: clean(sheet?.note, 400),
    rows,
    /* Its own read-only link. Turning sharing off keeps the token, so putting
       it back on restores the same link rather than breaking one already sent. */
    share: {
      enabled: Boolean(sheet?.share?.enabled),
      token: clean(sheet?.share?.token, 60) || newToken(),
    },
    department: clean(sheet?.department, 60) || "sdc",
    createdBy: clean(sheet?.createdBy, 60),
    updatedAt: sheet?.updatedAt || new Date().toISOString(),
  };
}

function normalizeState(raw) {
  const seen = new Set();
  const sheets = (Array.isArray(raw?.sheets) ? raw.sheets : [])
    .map(normalizeSheet)
    .filter((s) => (seen.has(s.id) ? false : seen.add(s.id)));
  return { version: 1, updatedAt: raw?.updatedAt || new Date().toISOString(), sheets };
}

const WRITE_OPTS = {
  access: "private",
  contentType: "application/json",
  allowOverwrite: true,
  addRandomSuffix: false,
  cacheControlMaxAge: 0,
};

const isEtagConflict = (error) =>
  error instanceof BlobPreconditionFailedError ||
  error?.name === "BlobPreconditionFailedError" ||
  /precondition failed|etag mismatch/i.test(String(error?.message || ""));

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function readPricing() {
  const result = await get(PATHNAME, { access: "private", useCache: false, cacheControlMaxAge: 0 });
  if (!result?.stream) {
    const state = normalizeState({ sheets: [] });
    const blob = await put(PATHNAME, JSON.stringify(state), WRITE_OPTS);
    return { state, etag: blob.etag };
  }
  const text = await new Response(result.stream).text();
  try {
    return { state: normalizeState(JSON.parse(text)), etag: result.blob.etag };
  } catch {
    return { state: normalizeState({ sheets: [] }), etag: result.blob.etag };
  }
}

async function mutate(mutator) {
  let lastError;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const current = await readPricing();
    const next = normalizeState({
      sheets: await mutator(current.state.sheets.map((s) => ({ ...s, rows: [...s.rows] }))),
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
  const latest = await readPricing();
  const finalState = normalizeState({
    sheets: await mutator(latest.state.sheets.map((s) => ({ ...s, rows: [...s.rows] }))),
    updatedAt: new Date().toISOString(),
  });
  try {
    await put(PATHNAME, JSON.stringify(finalState), WRITE_OPTS);
    return finalState;
  } catch (error) {
    throw lastError || error;
  }
}

export async function addSheet(data) {
  const draft = normalizeSheet({ ...data, updatedAt: new Date().toISOString() });
  return mutate((sheets) => [draft, ...sheets]);
}

export async function updateSheet(id, patch) {
  const target = clean(id, 60);
  return mutate((sheets) => {
    const found = sheets.find((s) => s.id === target);
    if (!found) throw new Error("That price list no longer exists.");
    const merged = normalizeSheet({ ...found, ...patch, id: target, updatedAt: new Date().toISOString() });
    return sheets.map((s) => (s.id === target ? merged : s));
  });
}

export async function removeSheet(id) {
  const target = clean(id, 60);
  return mutate((sheets) => sheets.filter((s) => s.id !== target));
}

// What a public link returns: the table, and nothing about who owns it.
export async function getSharedSheet(token) {
  const wanted = clean(token, 60);
  if (!wanted) return null;

  const { state } = await readPricing();
  const found = state.sheets.find((s) => s.share?.enabled && s.share.token === wanted);
  if (!found) return null;

  return { name: found.name, note: found.note, rows: found.rows, updatedAt: found.updatedAt };
}
