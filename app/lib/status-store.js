import "server-only";

import { BlobPreconditionFailedError, get, put } from "@vercel/blob";

const PATHNAME = "sdc/statuses.json";

// The four defaults are hardcoded and can never be deleted. Custom statuses
// are inserted before "Done" so Done always stays the last column.
const DEFAULTS = [
  { id: "todo",       name: "To Do",       color: "#8E8A96", soft: "#ECEBEE", isDefault: true },
  { id: "inprogress", name: "In Progress", color: "#3E8ED0", soft: "#E3EEF9", isDefault: true },
  { id: "inreview",   name: "In Review",   color: "#E0A93C", soft: "#FAEFD6", isDefault: true },
  { id: "done",       name: "Done",        color: "#3FA37A", soft: "#DEF1E7", isDefault: true },
];

// Colors handed out to custom statuses, cycled by how many already exist.
const PALETTE = [
  { color: "#7C5CD8", soft: "#EBE4FA" },
  { color: "#D86FB8", soft: "#F8E4F1" },
  { color: "#3FA0A3", soft: "#DDF0F0" },
  { color: "#C77D3C", soft: "#F7E9D6" },
  { color: "#5B8DEF", soft: "#E3ECFB" },
  { color: "#9A8C4A", soft: "#F0ECD8" },
];

const cleanName = (name) => String(name || "").trim().replace(/\s+/g, " ");
const slug = (name) => cleanName(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "status";

export function cleanStatusName(name) {
  const v = cleanName(name);
  if (!v) throw new Error("Status name is required.");
  if (v.length > 40) throw new Error("Status name is too long.");
  return v;
}

function normalizeList(list) {
  const seen = new Set();
  const out = [];
  for (const item of Array.isArray(list) ? list : []) {
    if (!item) continue;
    const id = String(item.id || slug(item.name)).trim();
    const name = cleanName(item.name);
    if (!id || !name || seen.has(id)) continue;
    seen.add(id);
    const def = DEFAULTS.find((d) => d.id === id);
    out.push({
      id,
      name,
      color: item.color || def?.color || "#8E8A96",
      soft: item.soft || def?.soft || "#ECEBEE",
      isDefault: !!def,
    });
  }
  // Guarantee every default is present (repairs an empty or corrupted blob).
  for (const d of DEFAULTS) {
    if (seen.has(d.id)) continue;
    const doneIdx = out.findIndex((s) => s.id === "done");
    if (d.id !== "done" && doneIdx !== -1) out.splice(doneIdx, 0, { ...d });
    else out.push({ ...d });
    seen.add(d.id);
  }
  return out;
}

function makeInitialState() {
  return { version: 1, updatedAt: new Date().toISOString(), statuses: normalizeList(DEFAULTS) };
}

async function parseResult(result) {
  if (!result?.stream) return null;
  const text = await new Response(result.stream).text();
  const parsed = JSON.parse(text);
  return { version: 1, updatedAt: parsed.updatedAt || new Date().toISOString(), statuses: normalizeList(parsed.statuses) };
}

async function createInitialBlob() {
  const state = makeInitialState();
  const blob = await put(PATHNAME, JSON.stringify(state), { access: "private", contentType: "application/json", allowOverwrite: true });
  return { state, etag: blob.etag };
}

export async function readStatusesState({ ifNoneMatch } = {}) {
  const result = await get(PATHNAME, { access: "private", useCache: false, ifNoneMatch: ifNoneMatch || undefined });
  if (!result) return createInitialBlob();
  if (result.statusCode === 304) return { notModified: true, etag: result.blob.etag };
  const state = await parseResult(result);
  if (!state) return createInitialBlob();
  return { state, etag: result.blob.etag, notModified: false };
}

async function mutateStatuses(mutator, maxAttempts = 5) {
  let lastError;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const current = await readStatusesState();
    const nextStatuses = normalizeList(await mutator([...current.state.statuses]));
    const nextState = { version: 1, updatedAt: new Date().toISOString(), statuses: nextStatuses };
    try {
      const blob = await put(PATHNAME, JSON.stringify(nextState), { access: "private", contentType: "application/json", allowOverwrite: true, ifMatch: current.etag });
      return { state: nextState, etag: blob.etag };
    } catch (error) {
      if (error instanceof BlobPreconditionFailedError) { lastError = error; continue; }
      throw error;
    }
  }
  throw lastError || new Error("The status list changed while saving. Please try again.");
}

export async function addStatus(name) {
  const clean = cleanStatusName(name);
  return mutateStatuses((list) => {
    if (list.some((s) => s.name.toLowerCase() === clean.toLowerCase())) throw new Error("That status already exists.");
    const ids = new Set(list.map((s) => s.id));
    let id = slug(clean), n = 2;
    while (ids.has(id)) id = `${slug(clean)}-${n++}`;
    const customCount = list.filter((s) => !s.isDefault).length;
    const pal = PALETTE[customCount % PALETTE.length];
    const status = { id, name: clean, color: pal.color, soft: pal.soft, isDefault: false };
    const doneIdx = list.findIndex((s) => s.id === "done");
    return doneIdx === -1 ? [...list, status] : [...list.slice(0, doneIdx), status, ...list.slice(doneIdx)];
  });
}

// Returns { state, etag, removed } — removed is the deleted status id (or null).
export async function deleteStatus(id) {
  const target = String(id || "");
  if (DEFAULTS.some((d) => d.id === target)) throw new Error("Default statuses can't be deleted.");
  let removed = null;
  const result = await mutateStatuses((list) => {
    if (list.some((s) => s.id === target)) removed = target;
    return list.filter((s) => s.id !== target);
  });
  return { ...result, removed };
}
