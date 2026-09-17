import "server-only";

import { BlobPreconditionFailedError, get, put } from "@vercel/blob";
import { randomUUID } from "node:crypto";

const PATHNAME = "sdc/tasks.json";

const pad = (n) => String(n).padStart(2, "0");
const dateOffset = (days) => {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + days);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
};

const DEFAULT_TASKS = [
  { id: "seed-1", title: "Wireframe Quencha PDP", project: "Quencha", desc: "Two-column layout with sticky add-to-cart", status: "inprogress", priority: "high", assignees: ["cn"], start: dateOffset(-1), due: dateOffset(2), time: "", tags: ["web", "ux"], attachments: [{ name: "pdp-wireframe.fig", size: 2415000 }], progress: 45 },
  { id: "seed-2", title: "Update brand colors — CRYSALIS", project: "CRYSALIS", desc: "Apply rebrand palette across the catalog", status: "todo", priority: "medium", assignees: [], start: dateOffset(0), due: dateOffset(4), time: "", tags: ["brand"], attachments: [], progress: 0 },
  { id: "seed-3", title: "Checkout flow redesign", project: "Website Revamp", desc: "Reduce checkout from 4 steps to 2", status: "inreview", priority: "high", assignees: ["cn", "jl", "sp"], start: dateOffset(-4), due: dateOffset(1), time: "14:00", tags: ["web", "cro"], attachments: [{ name: "flow.pdf", size: 530000 }, { name: "specs.docx", size: 82000 }], progress: 85 },
  { id: "seed-4", title: "Reel edits — FITSPIRE", project: "FITSPIRE", desc: "Three reels for launch week", status: "done", priority: "low", assignees: ["sp"], start: dateOffset(-6), due: dateOffset(-2), time: "", tags: ["content"], attachments: [], progress: 100 },
  { id: "seed-5", title: "Email template QA", project: "Daily Tasks", desc: "Check rendering in Outlook and mobile", status: "inreview", priority: "medium", assignees: [], start: dateOffset(-2), due: dateOffset(0), time: "", tags: ["email", "qa"], attachments: [], progress: 80 },
  { id: "seed-6", title: "Product shoot — SCRUBZ", project: "SCRUBZ", desc: "Studio booking and shot list", status: "todo", priority: "medium", assignees: ["sp"], start: dateOffset(1), due: dateOffset(5), time: "09:00", tags: ["shoot"], attachments: [], progress: 0 },
  { id: "seed-7", title: "Design system audit", project: "Sunbeams Lifestyle", desc: "Consolidate button and form tokens", status: "inprogress", priority: "medium", assignees: ["cn"], start: dateOffset(-3), due: dateOffset(3), time: "", tags: ["design", "system"], attachments: [{ name: "audit.xlsx", size: 120000 }], progress: 50 },
  { id: "seed-8", title: "Fix nav overflow bug", project: "Website Revamp", desc: "Mobile menu clips on iOS Safari", status: "todo", priority: "high", assignees: ["jl"], start: dateOffset(-2), due: dateOffset(-1), time: "", tags: ["bug", "web"], attachments: [], progress: 0 },
  { id: "seed-9", title: "Landing hero animation", project: "PRIMEO", desc: "Subtle parallax on scroll", status: "inprogress", priority: "low", assignees: ["cn"], start: dateOffset(0), due: dateOffset(6), time: "", tags: ["web", "motion"], attachments: [], progress: 35 },
  { id: "seed-10", title: "Publish blog — Nest Design Lab", project: "Nest Design Lab", desc: "SEO pass and hero image", status: "done", priority: "low", assignees: [], start: dateOffset(-8), due: dateOffset(-5), time: "", tags: ["content", "seo"], attachments: [], progress: 100 },
];

const cleanDate = (value) => {
  const text = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
};

const cleanAttachments = (items) => (
  Array.isArray(items)
    ? items
        .filter((item) => !item?.uploading)
        .map((item) => {
          const out = {
            name: String(item?.name || "Attachment").slice(0, 255),
            size: Math.max(0, Number(item?.size) || 0),
          };
          if (item?.url) out.url = String(item.url);
          if (item?.contentType) out.contentType = String(item.contentType);
          return out;
        })
    : []
);

function normalizeTask(task = {}) {
  const progress = task.progress == null || task.progress === ""
    ? undefined
    : Math.min(100, Math.max(0, Number(task.progress) || 0));

  const statusRaw = String(task.status || "").trim();
  const status = /^[a-z0-9][a-z0-9_-]*$/i.test(statusRaw) ? statusRaw : "todo";

  return {
    id: String(task.id || `task-${randomUUID()}`),
    title: String(task.title || "Untitled task").trim() || "Untitled task",
    project: String(task.project || "Daily Tasks"),
    desc: String(task.desc || ""),
    notes: String(task.notes || ""),
    status,
    priority: ["low", "medium", "high"].includes(task.priority) ? task.priority : "medium",
    assignees: [...new Set(Array.isArray(task.assignees) ? task.assignees.map(String).filter(Boolean) : [])],
    start: cleanDate(task.start),
    due: cleanDate(task.due),
    time: /^\d{2}:\d{2}$/.test(String(task.time || "")) ? String(task.time) : "",
    tags: [...new Set(Array.isArray(task.tags) ? task.tags.map((tag) => String(tag).trim()).filter(Boolean) : [])],
    attachments: cleanAttachments(task.attachments),
    ...(progress == null ? {} : { progress }),
    ...(task.larkRecordId ? { larkRecordId: String(task.larkRecordId) } : {}),
    ...(task.doneAt ? { doneAt: Number(task.doneAt) } : {}),
  };
}

function makeInitialState() {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    tasks: DEFAULT_TASKS.map(normalizeTask),
  };
}

async function parseResult(result) {
  if (!result?.stream) return null;
  const text = await new Response(result.stream).text();
  const parsed = JSON.parse(text);
  return {
    version: 1,
    updatedAt: parsed.updatedAt || new Date().toISOString(),
    tasks: Array.isArray(parsed.tasks) ? parsed.tasks.map(normalizeTask) : [],
  };
}

async function createInitialBlob() {
  const state = makeInitialState();
  const blob = await put(PATHNAME, JSON.stringify(state), {
    access: "private",
    contentType: "application/json",
    allowOverwrite: true,
    addRandomSuffix: false,
    cacheControlMaxAge: 60,
  });
  return { state, etag: blob.etag };
}

export async function readTasksState({ ifNoneMatch } = {}) {
  const result = await get(PATHNAME, {
    access: "private",
    useCache: false,
    ifNoneMatch: ifNoneMatch || undefined,
  });

  if (!result) return createInitialBlob();
  if (result.statusCode === 304) return { notModified: true, etag: result.blob.etag };

  const state = await parseResult(result);
  if (!state) return createInitialBlob();
  return { state, etag: result.blob.etag, notModified: false };
}

function isEtagConflict(error) {
  return error instanceof BlobPreconditionFailedError ||
    error?.name === "BlobPreconditionFailedError" ||
    /precondition failed|etag mismatch/i.test(String(error?.message || ""));
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function mutateTasks(mutator, maxAttempts = 12) {
  let lastError;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const current = await readTasksState();
    const nextTasks = await mutator(current.state.tasks.map((task) => ({
      ...task,
      assignees: [...task.assignees],
      tags: [...task.tags],
      attachments: task.attachments.map((attachment) => ({ ...attachment })),
    })));
    const nextState = {
      version: 1,
      updatedAt: new Date().toISOString(),
      tasks: nextTasks.map(normalizeTask),
    };

    try {
      const blob = await put(PATHNAME, JSON.stringify(nextState), {
        access: "private",
        contentType: "application/json",
        allowOverwrite: true,
        addRandomSuffix: false,
        cacheControlMaxAge: 60,
        ifMatch: current.etag,
      });
      return { state: nextState, etag: blob.etag };
    } catch (error) {
      if (!isEtagConflict(error)) throw error;
      lastError = error;
      await wait(25 * (attempt + 1));
    }
  }

  const latest = await readTasksState();
  const finalTasks = await mutator(latest.state.tasks.map((task) => ({
    ...task,
    assignees: [...task.assignees],
    tags: [...task.tags],
    attachments: task.attachments.map((attachment) => ({ ...attachment })),
  })));
  const finalState = {
    version: 1,
    updatedAt: new Date().toISOString(),
    tasks: finalTasks.map(normalizeTask),
  };

  try {
    const blob = await put(PATHNAME, JSON.stringify(finalState), {
      access: "private",
      contentType: "application/json",
      allowOverwrite: true,
      addRandomSuffix: false,
      cacheControlMaxAge: 60,
    });
    return { state: finalState, etag: blob.etag };
  } catch (error) {
    throw lastError || error;
  }
}

export function createTask(data = {}) {
  const task = { ...data, id: `task-${randomUUID()}` };
  if (task.status === "done" && !task.doneAt) task.doneAt = Date.now();
  return normalizeTask(task);
}

export function updateTask(existing, data = {}) {
  if (!existing) throw new Error("Task not found.");
  const merged = { ...existing, ...data, id: existing.id };
  const wasDone = existing.status === "done";
  const isDone = merged.status === "done";
  if (isDone && !wasDone) merged.doneAt = Date.now();   // just completed → stamp now
  else if (!isDone) delete merged.doneAt;               // reopened → clear
  // if it was and still is done, keep the original doneAt
  return normalizeTask(merged);
}
