import "server-only";

import { BlobPreconditionFailedError, get, put } from "@vercel/blob";

// Unchanged after the rename so existing records are not orphaned.
const PATHNAME = "sdc/print-speed.json";

const DEFAULT_LISTS = {
  brands: [
    "Sunbeams Lifestyle", "Quencha", "CRYSALIS", "SCRUBZ", "PRIMEO",
    "Slique", "FITSPIRE", "Nest Design Lab", "Gray Label",
  ],
  methods: ["Direct Print", "Sticker Print"],
  statuses: ["Not started", "Sample done", "Approved", "Printed", "In production", "On hold"],
  layouts: [
    { name: "Single-Sided Print",      note: "1 logo, icon, or image",               modes: ["Cylinder"] },
    { name: "Double-Sided Print",      note: "2 logos, icons, or images",            modes: ["Cylinder"] },
    { name: "Wraparound Print",        note: "continuous design around the product", modes: ["Cylinder"] },
    { name: "Full-Surface Print",      note: "1 full-size design",                   modes: ["Cylinder"] },
    { name: "Double-Sided Full Print", note: "full-size designs on front and back",  modes: ["Cylinder"] },
    { name: "Small",  note: "size limit to be set", modes: ["Flat"] },
    { name: "Medium", note: "size limit to be set", modes: ["Flat"] },
    { name: "Large",  note: "size limit to be set", modes: ["Flat"] },
  ],
};

export const MODES = ["Cylinder", "Flat"];
export const INK_LAYERS = ["Primer", "White", "CMYK", "Varnish"];
export const COLOR_CHOICES = ["Black", "White", "CMYK"];

const clean = (v) => String(v ?? "").trim().replace(/\s+/g, " ");
const num = (v) => {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const strList = (v, allowed) => {
  if (!Array.isArray(v)) return [];
  const out = v.map((x) => clean(x)).filter(Boolean);
  return allowed ? out.filter((x) => allowed.includes(x)) : out;
};

export function cleanOptionName(name) {
  const v = clean(name);
  if (!v) throw new Error("A name is required.");
  if (v.length > 60) throw new Error("That name is too long.");
  return v;
}

function normalizeLists(lists) {
  const source = lists && typeof lists === "object" ? lists : {};
  const simple = (key) => {
    const seen = new Set();
    const out = [];
    for (const item of Array.isArray(source[key]) ? source[key] : DEFAULT_LISTS[key]) {
      const name = clean(item);
      if (!name || seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());
      out.push(name);
    }
    return out.length ? out : [...DEFAULT_LISTS[key]];
  };

  const layouts = [];
  const seenLayout = new Set();
  for (const item of Array.isArray(source.layouts) ? source.layouts : DEFAULT_LISTS.layouts) {
    const name = clean(item?.name);
    if (!name || seenLayout.has(name.toLowerCase())) continue;
    const modes = strList(item?.modes, MODES);
    seenLayout.add(name.toLowerCase());
    layouts.push({ name, note: clean(item?.note), modes: modes.length ? modes : ["Cylinder"] });
  }

  return {
    brands: simple("brands"),
    methods: simple("methods"),
    statuses: simple("statuses"),
    layouts: layouts.length ? layouts : DEFAULT_LISTS.layouts.map((l) => ({ ...l })),
  };
}

function normalizeRecord(record, lists) {
  const mode = MODES.includes(record?.mode) ? record.mode : "Cylinder";
  const rec = ["slow", "med", "fast"].includes(record?.rec) ? record.rec : null;
  const layoutNames = lists.layouts.filter((l) => l.modes.includes(mode)).map((l) => l.name);

  return {
    id: String(record?.id || ""),
    brand: lists.brands.includes(clean(record?.brand)) ? clean(record.brand) : lists.brands[0],
    mode,
    img: clean(record?.img) || null,
    name: clean(record?.name),
    sku: clean(record?.sku),
    variant: clean(record?.variant),
    h: num(record?.h), w: num(record?.w), base: num(record?.base), ml: num(record?.ml),
    design: clean(record?.design) || "Untitled design",
    layout: layoutNames.includes(clean(record?.layout)) ? clean(record.layout) : null,
    method: lists.methods.includes(clean(record?.method)) ? clean(record.method) : lists.methods[0],
    paw: num(record?.paw), pah: num(record?.pah),
    colors: strList(record?.colors, COLOR_CHOICES),
    ink: strList(record?.ink, INK_LAYERS),
    slow: num(record?.slow), med: num(record?.med), fast: num(record?.fast),
    rec,
    status: lists.statuses.includes(clean(record?.status)) ? clean(record.status) : lists.statuses[0],
    remarks: clean(record?.remarks),
    createdAt: record?.createdAt || new Date().toISOString(),
    updatedAt: record?.updatedAt || new Date().toISOString(),
  };
}

function normalizeState(raw) {
  const lists = normalizeLists(raw?.lists);
  const records = (Array.isArray(raw?.records) ? raw.records : [])
    .filter((r) => r && r.id)
    .map((r) => normalizeRecord(r, lists));
  return {
    version: 1,
    updatedAt: raw?.updatedAt || new Date().toISOString(),
    lists,
    records,
  };
}

function makeInitialState() {
  return normalizeState({ records: [], lists: DEFAULT_LISTS });
}

async function parseResult(result) {
  if (!result?.stream) return null;
  const text = await new Response(result.stream).text();
  return normalizeState(JSON.parse(text));
}

async function createInitialBlob() {
  const state = makeInitialState();
  const blob = await put(PATHNAME, JSON.stringify(state), {
    access: "private", contentType: "application/json",
    allowOverwrite: true, addRandomSuffix: false, cacheControlMaxAge: 60,
  });
  return { state, etag: blob.etag };
}

export async function readPrintSpeedState({ ifNoneMatch } = {}) {
  const result = await get(PATHNAME, { access: "private", useCache: false, ifNoneMatch: ifNoneMatch || undefined });
  if (!result) return createInitialBlob();
  if (result.statusCode === 304) return { notModified: true, etag: result.blob.etag };
  const state = await parseResult(result);
  if (!state) return createInitialBlob();
  return { state, etag: result.blob.etag, notModified: false };
}

// The SDK does not always throw an instance we can match, so check the name and
// the message too. Same approach as the task store.
function isEtagConflict(error) {
  return error instanceof BlobPreconditionFailedError ||
    error?.name === "BlobPreconditionFailedError" ||
    /precondition failed|etag mismatch/i.test(String(error?.message || ""));
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const WRITE_OPTS = {
  access: "private",
  contentType: "application/json",
  allowOverwrite: true,
  addRandomSuffix: false,
  cacheControlMaxAge: 60,
};

async function buildNext(mutator) {
  const current = await readPrintSpeedState();
  const draft = {
    lists: JSON.parse(JSON.stringify(current.state.lists)),
    records: JSON.parse(JSON.stringify(current.state.records)),
  };
  const produced = await mutator(draft);
  const nextState = normalizeState({ ...(produced || draft), updatedAt: new Date().toISOString() });
  return { nextState, etag: current.etag };
}

async function mutateState(mutator, maxAttempts = 12) {
  let lastError;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const { nextState, etag } = await buildNext(mutator);
    try {
      const blob = await put(PATHNAME, JSON.stringify(nextState), { ...WRITE_OPTS, ifMatch: etag });
      return { state: nextState, etag: blob.etag };
    } catch (error) {
      if (!isEtagConflict(error)) throw error;
      lastError = error;
      await wait(25 * (attempt + 1));
    }
  }

  // Last resort: rebuild from the newest copy and write without the guard,
  // rather than losing the edit entirely.
  const { nextState } = await buildNext(mutator);
  try {
    const blob = await put(PATHNAME, JSON.stringify(nextState), WRITE_OPTS);
    return { state: nextState, etag: blob.etag };
  } catch (error) {
    throw lastError || error;
  }
}

const newId = () => `ps-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export async function createRecord(data) {
  return mutateState((draft) => {
    const now = new Date().toISOString();
    draft.records.unshift({ ...data, id: newId(), createdAt: now, updatedAt: now });
    return draft;
  });
}

export async function updateRecord(id, data) {
  const target = String(id || "");
  if (!target) throw new Error("A record id is required.");
  return mutateState((draft) => {
    draft.records = draft.records.map((r) =>
      r.id === target ? { ...r, ...data, id: r.id, createdAt: r.createdAt, updatedAt: new Date().toISOString() } : r
    );
    return draft;
  });
}

export async function deleteRecord(id) {
  const target = String(id || "");
  return mutateState((draft) => {
    draft.records = draft.records.filter((r) => r.id !== target);
    return draft;
  });
}

const LIST_FIELD = { brands: "brand", methods: "method", statuses: "status", layouts: "layout" };

function namesIn(draft, list) {
  return list === "layouts" ? draft.lists.layouts.map((l) => l.name) : draft.lists[list];
}

export async function addOption(list, name, mode, note) {
  if (!LIST_FIELD[list]) throw new Error("Unknown option list.");
  const value = cleanOptionName(name);
  const noteText = clean(note).slice(0, 120);
  return mutateState((draft) => {
    if (namesIn(draft, list).some((n) => n.toLowerCase() === value.toLowerCase())) {
      throw new Error("That option already exists.");
    }
    if (list === "layouts") {
      draft.lists.layouts.push({ name: value, note: noteText, modes: [MODES.includes(mode) ? mode : "Cylinder"] });
    } else {
      draft.lists[list].push(value);
    }
    return draft;
  });
}

// Renames an option and, for print coverage, edits its short description.
// Pass only what changes: { newName }, { note }, or both.
export async function updateOption(list, name, { newName, note } = {}) {
  if (!LIST_FIELD[list]) throw new Error("Unknown option list.");
  const from = cleanOptionName(name);
  const to = newName === undefined ? from : cleanOptionName(newName);
  const nextNote = note === undefined ? undefined : clean(note).slice(0, 120);

  return mutateState((draft) => {
    const existing = namesIn(draft, list);
    if (!existing.some((n) => n === from)) throw new Error("That option no longer exists.");
    if (from !== to && existing.some((n) => n.toLowerCase() === to.toLowerCase())) {
      throw new Error("That option already exists.");
    }
    if (list === "layouts") {
      draft.lists.layouts = draft.lists.layouts.map((l) =>
        l.name === from ? { ...l, name: to, note: nextNote === undefined ? l.note : nextNote } : l
      );
    } else {
      if (nextNote !== undefined) throw new Error("Only print coverage options carry a description.");
      draft.lists[list] = draft.lists[list].map((n) => (n === from ? to : n));
    }
    if (from !== to) {
      const field = LIST_FIELD[list];
      draft.records = draft.records.map((r) => (r[field] === from ? { ...r, [field]: to } : r));
    }
    return draft;
  });
}

// Kept for callers that only rename.
export async function renameOption(list, name, newName) {
  return updateOption(list, name, { newName });
}

export async function removeOption(list, name) {
  if (!LIST_FIELD[list]) throw new Error("Unknown option list.");
  const value = cleanOptionName(name);
  return mutateState((draft) => {
    const field = LIST_FIELD[list];
    const inUse = draft.records.filter((r) => r[field] === value).length;
    if (inUse) throw new Error(`In use by ${inUse} record${inUse === 1 ? "" : "s"}.`);
    if (list === "layouts") {
      draft.lists.layouts = draft.lists.layouts.filter((l) => l.name !== value);
    } else {
      if (draft.lists[list].length <= 1) throw new Error("At least one option has to remain.");
      draft.lists[list] = draft.lists[list].filter((n) => n !== value);
    }
    return draft;
  });
}
