import "server-only";
import { backoff, isEtagConflict, MAX_ATTEMPTS } from "./blob-retry";

import { get, put } from "@vercel/blob";
import { randomUUID } from "node:crypto";

import { deptBlobPath, LEGACY_DEPT } from "./dept-path";

// "Plugs" — the ready-made tasks each department keeps and drags into a
// playbook. Each department owns its own library and its own task types.
//   sdc/flow-templates.json   depts/<id>/flow-templates.json
const FILE = "flow-templates";
const pathFor = (dept) => deptBlobPath(dept, FILE);

export const DURATION_UNITS = ["h", "d", "w"];
export const PRIORITIES = ["low", "medium", "high"];

const clean = (value, max) => String(value ?? "").trim().replace(/\s+/g, " ").slice(0, max);
const multiline = (value, max) => String(value ?? "").trim().slice(0, max);
const slug = (value) => clean(value, 40).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30);

// Digital Creative already works in these shapes, so SDC starts with a real library.
const SDC_TYPES = ["Shoot", "Image", "Design", "Video", "Copy", "Review"];
const SDC_TEMPLATES = [
  { title: "Product shoot", type: "shoot", duration: { value: 1, unit: "d" }, priority: "high", desc: "Studio booking, shot list and styling for the SKU." },
  { title: "Product image", type: "image", duration: { value: 1, unit: "d" }, priority: "high", desc: "Main, variant and detail shots on white." },
  { title: "Lifestyle image", type: "image", duration: { value: 1, unit: "d" }, priority: "medium", desc: "In-use lifestyle set for the listing and ads." },
  { title: "Infographic", type: "design", duration: { value: 4, unit: "h" }, priority: "medium", desc: "Feature callouts, sizing and what's in the box." },
  { title: "CEM banner", type: "design", duration: { value: 4, unit: "h" }, priority: "medium", desc: "Campaign banner set for the CEM placements." },
  { title: "Store banner", type: "design", duration: { value: 4, unit: "h" }, priority: "medium", desc: "Shop front banner, desktop and mobile crops." },
  { title: "Feed post", type: "image", duration: { value: 4, unit: "h" }, priority: "medium", desc: "Square feed asset with caption-ready layout." },
  { title: "Story", type: "image", duration: { value: 2, unit: "h" }, priority: "low", desc: "9:16 story frame with safe-area margins." },
  { title: "Showcase video", type: "video", duration: { value: 2, unit: "d" }, priority: "high", desc: "Hero product video for the listing and paid placements." },
  { title: "Reel / TikTok edit", type: "video", duration: { value: 1, unit: "d" }, priority: "medium", desc: "Short vertical cut with hook, demo and CTA." },
  { title: "Copy & captions", type: "copy", duration: { value: 2, unit: "h" }, priority: "medium", desc: "Headline, caption and on-asset copy." },
  { title: "Creative review", type: "review", duration: { value: 4, unit: "h" }, priority: "medium", desc: "Brand check against the guidelines before release." },
];

// Every other department starts with a neutral set it can rename or replace.
const DEFAULT_TYPES = ["Plan", "Execute", "Review", "Approval"];
const DEFAULT_TEMPLATES = [
  { title: "Kickoff brief", type: "plan", duration: { value: 2, unit: "h" }, priority: "high", desc: "Scope, owner and success measure agreed in writing." },
  { title: "Prepare requirements", type: "plan", duration: { value: 1, unit: "d" }, priority: "medium", desc: "Everything the next step needs before it can start." },
  { title: "Execute", type: "execute", duration: { value: 2, unit: "d" }, priority: "medium", desc: "The main work of this stage." },
  { title: "Internal review", type: "review", duration: { value: 4, unit: "h" }, priority: "medium", desc: "Checked by someone who didn't do the work." },
  { title: "Head of department approval", type: "approval", duration: { value: 4, unit: "h" }, priority: "high", desc: "Sign-off before it moves on." },
  { title: "Handover", type: "approval", duration: { value: 2, unit: "h" }, priority: "low", desc: "Files, links and notes passed to the next department." },
];

export function normalizeDuration(duration) {
  const value = Math.min(999, Math.max(0, Number(duration?.value) || 0));
  const unit = DURATION_UNITS.includes(duration?.unit) ? duration.unit : "d";
  return { value, unit };
}

export function normalizeLinks(links) {
  return (Array.isArray(links) ? links : [])
    .map((link) => ({
      label: clean(link?.label, 80),
      url: /^https?:\/\//i.test(String(link?.url || "")) ? clean(link.url, 500) : "",
    }))
    .filter((link) => link.url)
    .map((link) => ({ label: link.label || link.url.replace(/^https?:\/\//i, "").slice(0, 60), url: link.url }))
    .slice(0, 20);
}

// No fallback here on purpose: a department that deliberately clears its type
// list keeps it cleared. Seeding happens once, when the blob is first created.
function normalizeTypes(list) {
  const seen = new Set();
  const out = [];
  for (const item of Array.isArray(list) ? list : []) {
    const name = clean(item?.name, 40);
    if (!name) continue;
    let id = slug(item?.id || name) || "type";
    while (seen.has(id)) id = `${id}-2`;
    seen.add(id);
    out.push({ id, name });
  }
  return out.slice(0, 24);
}

function normalizeTemplate(template, typeIds) {
  const type = slug(template?.type || "");
  return {
    id: String(template?.id || `tpl-${randomUUID()}`),
    title: clean(template?.title, 120) || "Untitled plug",
    type: typeIds.has(type) ? type : "",
    desc: multiline(template?.desc, 1000),
    notes: multiline(template?.notes, 2000),
    priority: PRIORITIES.includes(template?.priority) ? template.priority : "medium",
    duration: normalizeDuration(template?.duration),
    links: normalizeLinks(template?.links),
  };
}

function normalizePayload(parsed) {
  const types = normalizeTypes(parsed?.types);
  const typeIds = new Set(types.map((t) => t.id));
  const templates = (Array.isArray(parsed?.templates) ? parsed.templates : [])
    .map((t) => normalizeTemplate(t, typeIds))
    .slice(0, 200);
  return { types, templates };
}

function makeInitialState(dept) {
  const names = dept === LEGACY_DEPT ? SDC_TYPES : DEFAULT_TYPES;
  const seed = {
    types: names.map((name) => ({ id: slug(name), name })),
    templates: dept === LEGACY_DEPT ? SDC_TEMPLATES : DEFAULT_TEMPLATES,
  };
  const { types, templates } = normalizePayload(seed);
  return { version: 1, updatedAt: new Date().toISOString(), types, templates };
}

async function createInitialBlob(dept) {
  const state = makeInitialState(dept);
  const blob = await put(pathFor(dept), JSON.stringify(state), {
    access: "private",
    contentType: "application/json",
    allowOverwrite: true,
    addRandomSuffix: false,
  });
  return { state, etag: blob.etag };
}

export async function readTemplatesState({ dept = LEGACY_DEPT } = {}) {
  const result = await get(pathFor(dept), { access: "private", useCache: false });
  if (!result?.stream) return createInitialBlob(dept);
  const parsed = JSON.parse(await new Response(result.stream).text());
  const { types, templates } = normalizePayload(parsed);
  return {
    state: { version: 1, updatedAt: parsed.updatedAt || new Date().toISOString(), types, templates },
    etag: result.blob.etag,
  };
}

// Whole-library replace: the Plugs page hands back the full list of types and plugs.
export async function writeTemplates(dept, payload) {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const current = await readTemplatesState({ dept });
    const { types, templates } = normalizePayload(payload);
    const next = { version: 1, updatedAt: new Date().toISOString(), types, templates };
    try {
      const blob = await put(pathFor(dept), JSON.stringify(next), {
        access: "private",
        contentType: "application/json",
        allowOverwrite: true,
        addRandomSuffix: false,
        ifMatch: current.etag,
      });
      return { state: next, etag: blob.etag };
    } catch (error) {
      if (!isEtagConflict(error)) throw error;
      await backoff(attempt);
    }
  }

  // Fallback: save against the newest copy without the condition.
  const { types, templates } = normalizePayload(payload);
  const finalState = { version: 1, updatedAt: new Date().toISOString(), types, templates };
  const blob = await put(pathFor(dept), JSON.stringify(finalState), {
    access: "private",
    contentType: "application/json",
    allowOverwrite: true,
    addRandomSuffix: false,
  });
  return { state: finalState, etag: blob.etag };
}
