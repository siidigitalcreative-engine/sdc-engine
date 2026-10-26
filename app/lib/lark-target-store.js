import { BlobPreconditionFailedError, get, put } from "@vercel/blob";

const PATHNAME = "sdc/lark-targets.json";

export const DEFAULT_TARGET_ID = "default";

// Purposes a destination can be the default for. Add to this list and the
// pickers pick it up; nothing else needs to change.
export const PURPOSES = ["tasks", "calendar", "projects", "print"];

const clean = (v) => String(v ?? "").trim().replace(/\s+/g, " ");

// Any https webhook is allowed, so a new group chat, a regional Lark domain or
// a self-hosted relay can be added later without touching this file. What is
// refused is anything that would aim the server at its own network.
const PRIVATE_HOST = /^(localhost|127\.|0\.|10\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$|\[?f[cd])/i;

export function validateWebhook(raw) {
  const value = String(raw || "").trim();
  if (!value) throw new Error("A webhook URL is required.");
  if (value.length > 500) throw new Error("That URL is too long.");

  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("That is not a valid URL.");
  }
  if (url.protocol !== "https:") throw new Error("The webhook has to be an https URL.");
  if (url.username || url.password) throw new Error("Remove the username and password from the URL.");
  if (!url.hostname.includes(".") || PRIVATE_HOST.test(url.hostname)) {
    throw new Error("That host is not reachable as a webhook.");
  }
  return url.toString();
}

// Only a Lark custom bot accepts the image messages the exports produce, so the
// picker can warn rather than silently fail on a webhook from somewhere else.
export function looksLikeLark(value) {
  try {
    const url = new URL(value);
    return /(^|\.)(larksuite\.com|feishu\.cn)$/i.test(url.hostname)
      && url.pathname.includes("/bot/v2/hook/");
  } catch {
    return false;
  }
}

// Shows enough of the URL to tell two destinations apart, without printing the
// secret part into anyone's screen share.
export function maskWebhook(value) {
  const tail = String(value || "").split("/").pop() || "";
  return tail.length > 8 ? `…${tail.slice(-8)}` : "…";
}

function normalizeState(raw) {
  const seen = new Set();
  const targets = (Array.isArray(raw?.targets) ? raw.targets : [])
    .map((t) => ({
      id: clean(t?.id),
      name: clean(t?.name).slice(0, 60),
      webhook: String(t?.webhook || "").trim(),
      defaultFor: Array.isArray(t?.defaultFor)
        ? [...new Set(t.defaultFor.map((p) => clean(p)).filter((p) => PURPOSES.includes(p)))]
        : [],
      createdAt: t?.createdAt || new Date().toISOString(),
    }))
    .filter((t) => {
      if (!t.id || !t.name || !t.webhook) return false;
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });
  return { version: 1, updatedAt: raw?.updatedAt || new Date().toISOString(), targets };
}

const WRITE_OPTS = {
  access: "private",
  contentType: "application/json",
  allowOverwrite: true,
  addRandomSuffix: false,
  cacheControlMaxAge: 60,
};

async function createInitialBlob() {
  const state = normalizeState({ targets: [] });
  const blob = await put(PATHNAME, JSON.stringify(state), WRITE_OPTS);
  return { state, etag: blob.etag };
}

export async function readTargetsState() {
  const result = await get(PATHNAME, { access: "private", useCache: false });
  if (!result) return createInitialBlob();
  const text = await new Response(result.stream).text();
  try {
    return { state: normalizeState(JSON.parse(text)), etag: result.blob.etag };
  } catch {
    return createInitialBlob();
  }
}

function isEtagConflict(error) {
  return error instanceof BlobPreconditionFailedError ||
    error?.name === "BlobPreconditionFailedError" ||
    /precondition failed|etag mismatch/i.test(String(error?.message || ""));
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function mutateTargets(mutator, maxAttempts = 12) {
  let lastError;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const current = await readTargetsState();
    const next = normalizeState({
      targets: await mutator(current.state.targets.map((t) => ({ ...t }))),
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

  const latest = await readTargetsState();
  const finalState = normalizeState({
    targets: await mutator(latest.state.targets.map((t) => ({ ...t }))),
    updatedAt: new Date().toISOString(),
  });
  try {
    const blob = await put(PATHNAME, JSON.stringify(finalState), WRITE_OPTS);
    return { state: finalState, etag: blob.etag };
  } catch (error) {
    throw lastError || error;
  }
}

const newId = () => `lt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export async function addTarget(name, webhook) {
  const label = clean(name).slice(0, 60);
  if (!label) throw new Error("A name is required.");
  const url = validateWebhook(webhook);
  return mutateTargets((targets) => {
    if (targets.some((t) => t.name.toLowerCase() === label.toLowerCase())) {
      throw new Error("A destination with that name already exists.");
    }
    if (targets.length >= 25) throw new Error("That is as many destinations as this list holds.");
    return [...targets, { id: newId(), name: label, webhook: url, defaultFor: [], createdAt: new Date().toISOString() }];
  });
}

export async function updateTarget(id, { name, webhook, defaultFor } = {}) {
  const target = clean(id);
  const label = name === undefined ? undefined : clean(name).slice(0, 60);
  const url = webhook === undefined || webhook === "" ? undefined : validateWebhook(webhook);
  const purposes = defaultFor === undefined
    ? undefined
    : [...new Set((Array.isArray(defaultFor) ? defaultFor : [defaultFor]).map(clean).filter((p) => PURPOSES.includes(p)))];

  return mutateTargets((targets) => {
    if (!targets.some((t) => t.id === target)) throw new Error("That destination no longer exists.");
    return targets.map((t) => {
      if (t.id !== target) {
        // One default per purpose, so claiming it takes it off the others.
        return purposes === undefined
          ? t
          : { ...t, defaultFor: t.defaultFor.filter((p) => !purposes.includes(p)) };
      }
      return {
        ...t,
        name: label === undefined || !label ? t.name : label,
        webhook: url === undefined ? t.webhook : url,
        defaultFor: purposes === undefined ? t.defaultFor : purposes,
      };
    });
  });
}

export async function removeTarget(id) {
  const target = clean(id);
  return mutateTargets((targets) => targets.filter((t) => t.id !== target));
}

// The group configured in the environment stays available as a built-in choice,
// so nothing breaks for anyone who never adds a destination.
export function envWebhook(kind) {
  const tasks = process.env.LARK_TASKS_BOT_WEBHOOK || "";
  const calendar = process.env.LARK_CALENDAR_BOT_WEBHOOK || "";
  const projects = process.env.LARK_PROJECTS_BOT_WEBHOOK || "";
  if (kind === "calendar") return calendar || tasks || projects;
  if (kind === "projects") return projects || tasks || calendar;
  return tasks || calendar || projects;
}

// Resolves the webhook to post to. The client only ever sends an id, never a
// URL, so a saved destination is the only thing that can be posted to.
// With no id, falls back to whichever destination is marked default for this
// purpose, then to the environment. So a send can always find somewhere to go.
export async function resolveWebhook(targetId, kind = "tasks") {
  const id = clean(targetId);
  if (id && id !== DEFAULT_TARGET_ID) {
    const { state } = await readTargetsState();
    const found = state.targets.find((t) => t.id === id);
    if (!found) throw new Error("That destination no longer exists.");
    return found.webhook;
  }
  if (!id) {
    const { state } = await readTargetsState();
    const preferred = state.targets.find((t) => t.defaultFor.includes(kind));
    if (preferred) return preferred.webhook;
  }
  return envWebhook(kind);
}

export async function listTargets(kind = "tasks") {
  const { state } = await readTargetsState();
  const fallback = envWebhook(kind);
  const list = state.targets.map((t) => ({
    id: t.id,
    name: t.name,
    hint: maskWebhook(t.webhook),
    host: hostOf(t.webhook),
    lark: looksLikeLark(t.webhook),
    defaultFor: t.defaultFor,
    isDefault: t.defaultFor.includes(kind),
  }));
  return fallback
    ? [{
        id: DEFAULT_TARGET_ID,
        name: "Group set in the environment",
        hint: maskWebhook(fallback),
        host: hostOf(fallback),
        lark: looksLikeLark(fallback),
        defaultFor: [],
        builtIn: true,
      }, ...list]
    : list;
}

function hostOf(value) {
  try { return new URL(value).hostname; } catch { return ""; }
}
