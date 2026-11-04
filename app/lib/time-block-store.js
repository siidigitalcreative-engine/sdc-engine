import "server-only";

import { BlobPreconditionFailedError, get, put } from "@vercel/blob";

const PATHNAME = "sdc/time-blocks.json";

export const DAY_START_MIN = 7 * 60;    // the board runs 07:00 to 20:00
export const DAY_END_MIN = 20 * 60;
export const SLOT_MIN = 5;

const KINDS = ["task", "subtask", "project"];
const clean = (v) => String(v ?? "").trim();
const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));

// Snap to the slot size so a block can never sit between rows.
const snap = (v) => Math.round(Number(v) / SLOT_MIN) * SLOT_MIN;

function normalizeBlock(block) {
  const start = Math.max(DAY_START_MIN, Math.min(DAY_END_MIN - SLOT_MIN, snap(block?.start)));
  const end = Math.max(start + SLOT_MIN, Math.min(DAY_END_MIN, snap(block?.end)));
  return {
    id: clean(block?.id),
    member: clean(block?.member),
    date: isDate(block?.date) ? block.date : "",
    kind: KINDS.includes(block?.kind) ? block.kind : "task",
    refId: clean(block?.refId),
    // Carried with the block so the timeline still reads correctly if the task
    // is renamed, archived or deleted later.
    title: clean(block?.title).slice(0, 120),
    parentTitle: clean(block?.parentTitle).slice(0, 120),
    project: clean(block?.project).slice(0, 80),
    color: /^#[0-9a-f]{6}$/i.test(String(block?.color)) ? block.color : "#3E8ED0",
    start,
    end,
    note: clean(block?.note).slice(0, 160),
    createdAt: block?.createdAt || new Date().toISOString(),
  };
}

function normalizeState(raw) {
  const seen = new Set();
  const blocks = (Array.isArray(raw?.blocks) ? raw.blocks : [])
    .map(normalizeBlock)
    .filter((b) => b.id && b.member && b.date && !seen.has(b.id) && seen.add(b.id));
  return { version: 1, updatedAt: raw?.updatedAt || new Date().toISOString(), blocks };
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

async function createInitialBlob() {
  const state = normalizeState({ blocks: [] });
  const blob = await put(PATHNAME, JSON.stringify(state), WRITE_OPTS);
  return { state, etag: blob.etag };
}

export async function readTimeBlocksState() {
  const result = await get(PATHNAME, { access: "private", useCache: false, cacheControlMaxAge: 0 });
  if (!result?.stream) return createInitialBlob();
  const text = await new Response(result.stream).text();
  try {
    return { state: normalizeState(JSON.parse(text)), etag: result.blob.etag };
  } catch {
    return createInitialBlob();
  }
}

async function mutate(mutator, maxAttempts = 12) {
  let lastError;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const current = await readTimeBlocksState();
    const next = normalizeState({
      blocks: await mutator(current.state.blocks.map((b) => ({ ...b }))),
      updatedAt: new Date().toISOString(),
    });
    try {
      const blob = await put(PATHNAME, JSON.stringify(next), { ...WRITE_OPTS, ifMatch: current.etag });
      return { state: next, etag: blob.etag };
    } catch (error) {
      if (!isEtagConflict(error)) throw error;
      lastError = error;
      await wait(25 * (attempt + 1));
    }
  }
  const latest = await readTimeBlocksState();
  const finalState = normalizeState({
    blocks: await mutator(latest.state.blocks.map((b) => ({ ...b }))),
    updatedAt: new Date().toISOString(),
  });
  try {
    const blob = await put(PATHNAME, JSON.stringify(finalState), WRITE_OPTS);
    return { state: finalState, etag: blob.etag };
  } catch (error) {
    throw lastError || error;
  }
}

const newId = () => `tb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

export async function listBlocks(date) {
  const { state } = await readTimeBlocksState();
  return isDate(date) ? state.blocks.filter((b) => b.date === date) : state.blocks;
}

export async function addBlock(memberId, data) {
  const draft = normalizeBlock({ ...data, id: newId(), member: memberId, createdAt: new Date().toISOString() });
  if (!draft.date) throw new Error("A date is required.");
  if (!draft.title) throw new Error("Nothing was chosen to block.");
  return mutate((blocks) => {
    return [...blocks, draft];
  });
}

export async function moveBlock(memberId, id, { start, end, note, title }) {
  const target = clean(id);
  return mutate((blocks) => {
    const found = blocks.find((b) => b.id === target);
    if (!found) throw new Error("That block no longer exists.");
    if (found.member !== memberId) throw new Error("That block belongs to someone else.");

    const next = normalizeBlock({
      ...found,
      start: start === undefined ? found.start : start,
      end: end === undefined ? found.end : end,
      note: note === undefined ? found.note : note,
      title: title === undefined ? found.title : title,
    });
    return blocks.map((b) => (b.id === target ? next : b));
  });
}

export async function removeBlock(memberId, id) {
  const target = clean(id);
  return mutate((blocks) => {
    const found = blocks.find((b) => b.id === target);
    if (!found) return blocks;
    if (found.member !== memberId) throw new Error("That block belongs to someone else.");
    return blocks.filter((b) => b.id !== target);
  });
}

export async function clearDay(memberId, date) {
  if (!isDate(date)) throw new Error("A date is required.");
  return mutate((blocks) => blocks.filter((b) => !(b.member === memberId && b.date === date)));
}
