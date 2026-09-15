import "server-only";

import { BlobPreconditionFailedError, get, put } from "@vercel/blob";

const PATHNAME = "sdc/projects.json";
const DEFAULT_PROJECTS = ["Quencha", "CRYSALIS", "Website Revamp", "FITSPIRE", "SCRUBZ", "Sunbeams Lifestyle", "PRIMEO", "Nest Design Lab", "Daily Tasks"];

const clean = (name) => String(name || "").trim().replace(/\s+/g, " ");

function normalizeList(list) {
  const seen = new Set();
  const out = [];
  for (const item of Array.isArray(list) ? list : []) {
    const name = clean(item);
    if (!name) continue;
    const k = name.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(name);
  }
  return out;
}

export function cleanProjectName(name) {
  const v = clean(name);
  if (!v) throw new Error("Project name is required.");
  if (v.length > 60) throw new Error("Project name is too long.");
  return v;
}

function makeInitialState() {
  return { version: 1, updatedAt: new Date().toISOString(), projects: normalizeList(DEFAULT_PROJECTS) };
}

async function parseResult(result) {
  if (!result?.stream) return null;
  const text = await new Response(result.stream).text();
  const parsed = JSON.parse(text);
  return { version: 1, updatedAt: parsed.updatedAt || new Date().toISOString(), projects: normalizeList(parsed.projects) };
}

async function createInitialBlob() {
  const state = makeInitialState();
  const blob = await put(PATHNAME, JSON.stringify(state), { access: "private", contentType: "application/json", allowOverwrite: true });
  return { state, etag: blob.etag };
}

export async function readProjectsState({ ifNoneMatch } = {}) {
  const result = await get(PATHNAME, { access: "private", useCache: false, ifNoneMatch: ifNoneMatch || undefined });
  if (!result) return createInitialBlob();
  if (result.statusCode === 304) return { notModified: true, etag: result.blob.etag };
  const state = await parseResult(result);
  if (!state) return createInitialBlob();
  return { state, etag: result.blob.etag, notModified: false };
}

export async function mutateProjects(mutator, maxAttempts = 5) {
  let lastError;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const current = await readProjectsState();
    const nextProjects = normalizeList(await mutator([...current.state.projects]));
    const nextState = { version: 1, updatedAt: new Date().toISOString(), projects: nextProjects };
    try {
      const blob = await put(PATHNAME, JSON.stringify(nextState), { access: "private", contentType: "application/json", allowOverwrite: true, ifMatch: current.etag });
      return { state: nextState, etag: blob.etag };
    } catch (error) {
      if (error instanceof BlobPreconditionFailedError) { lastError = error; continue; }
      throw error;
    }
  }
  throw lastError || new Error("The project list changed while saving. Please try again.");
}
