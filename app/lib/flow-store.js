import "server-only";
import { backoff, isEtagConflict, MAX_ATTEMPTS } from "./blob-retry";

import { get, put } from "@vercel/blob";
import { randomUUID } from "node:crypto";

import { deptBlobPath, LEGACY_DEPT, isValidDeptId } from "./dept-path";
import { normalizeDuration, normalizeLinks, PRIORITIES } from "./flow-template-store";

// A playbook is one process from start to finish — "new SKU launch", "monthly
// campaign refresh". Its items are an ordered mix of steps and section
// dividers, and each step carries the department that owns it, so one playbook
// runs across E-commerce, Marketing and Digital Creative.
//   sdc/flows.json   depts/<id>/flows.json
const FILE = "flows";
const pathFor = (dept) => deptBlobPath(dept, FILE);

const EVENT_KINDS = ["run", "plug", "step", "sub", "edit"];

const clean = (value, max) => String(value ?? "").trim().replace(/\s+/g, " ").slice(0, max);
const multiline = (value, max) => String(value ?? "").trim().slice(0, max);
const id = (prefix) => `${prefix}-${randomUUID()}`;
const stamp = (value) => (Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : null);

function normalizeSubtask(task = {}) {
  return {
    id: String(task.id || id("st")),
    title: clean(task.title, 160) || "Untitled subtask",
    done: !!task.done,
    assignee: task.assignee ? String(task.assignee).slice(0, 40) : "",
  };
}

function normalizeStep(step = {}) {
  const statusRaw = String(step.status || "").trim();
  return {
    kind: "step",
    id: String(step.id || id("step")),
    title: clean(step.title, 160) || "Untitled step",
    dept: isValidDeptId(step.dept) ? String(step.dept) : "",
    type: String(step.type || "").replace(/[^a-z0-9-]/gi, "").toLowerCase().slice(0, 30),
    status: /^[a-z0-9][a-z0-9_-]*$/i.test(statusRaw) ? statusRaw : "todo",
    priority: PRIORITIES.includes(step.priority) ? step.priority : "medium",
    duration: normalizeDuration(step.duration),
    assignees: [...new Set(Array.isArray(step.assignees) ? step.assignees.map(String).filter(Boolean) : [])].slice(0, 20),
    subtasks: (Array.isArray(step.subtasks) ? step.subtasks : []).map(normalizeSubtask).slice(0, 50),
    desc: multiline(step.desc, 2000),
    notes: multiline(step.notes, 4000),
    links: normalizeLinks(step.links),
    ...(stamp(step.doneAt) ? { doneAt: stamp(step.doneAt) } : {}),
    ...(step.templateId ? { templateId: String(step.templateId).slice(0, 60) } : {}),
    ...(step.taskId ? { taskId: String(step.taskId).slice(0, 60) } : {}),
  };
}

// A divider is a label only: it groups the steps under it so everyone can see
// where the work hands over.
function normalizeSection(section = {}) {
  return {
    kind: "section",
    id: String(section.id || id("sec")),
    label: clean(section.label, 80) || "Section",
    dept: isValidDeptId(section.dept) ? String(section.dept) : "",
  };
}

const normalizeItem = (item = {}) => (item.kind === "section" ? normalizeSection(item) : normalizeStep(item));

function normalizeEvent(event = {}) {
  return {
    id: String(event.id || id("ev")),
    at: stamp(event.at) || Date.now(),
    who: String(event.who || "").slice(0, 40),
    verb: clean(event.verb, 120),
    subject: clean(event.subject, 180),
    kind: EVENT_KINDS.includes(event.kind) ? event.kind : "edit",
  };
}

function normalizeFlow(flow = {}) {
  const depts = [...new Set((Array.isArray(flow.depts) ? flow.depts : []).filter(isValidDeptId).map(String))].slice(0, 12);
  return {
    id: String(flow.id || id("flow")),
    name: clean(flow.name, 120) || "Untitled playbook",
    desc: multiline(flow.desc, 1000),
    depts,
    items: (Array.isArray(flow.items) ? flow.items : []).map(normalizeItem).slice(0, 300),
    history: (Array.isArray(flow.history) ? flow.history : []).map(normalizeEvent).slice(-300),
    createdAt: stamp(flow.createdAt) || Date.now(),
    updatedAt: stamp(flow.updatedAt) || Date.now(),
    ...(stamp(flow.startedAt) ? { startedAt: stamp(flow.startedAt) } : {}),
    ...(stamp(flow.pausedAt) ? { pausedAt: stamp(flow.pausedAt) } : {}),
    ...(Number(flow.pausedMs) > 0 ? { pausedMs: Number(flow.pausedMs) } : {}),
    ...(flow.archived ? { archived: true } : {}),
    ...(flow.deleted ? { deleted: true } : {}),
    ...(stamp(flow.deletedAt) ? { deletedAt: stamp(flow.deletedAt) } : {}),
    ...(flow.createdBy ? { createdBy: String(flow.createdBy).slice(0, 40) } : {}),
  };
}

function makeInitialState() {
  return { version: 1, updatedAt: new Date().toISOString(), flows: [] };
}

async function createInitialBlob(dept) {
  const state = makeInitialState();
  const blob = await put(pathFor(dept), JSON.stringify(state), {
    access: "private",
    contentType: "application/json",
    allowOverwrite: true,
    addRandomSuffix: false,
  });
  return { state, etag: blob.etag };
}

export async function readFlowsState({ dept = LEGACY_DEPT, ifNoneMatch } = {}) {
  // On the very first run there is no blob yet, and a private blob that does
  // not exist throws rather than returning empty — seed it instead of failing.
  let result = null;
  try {
    result = await get(pathFor(dept), {
      access: "private",
      useCache: false,
      ifNoneMatch: ifNoneMatch || undefined,
    });
  } catch (error) {
    const message = String(error?.message || "");
    if (!/not.?found|404|does not exist/i.test(message)) throw error;
  }
  if (!result) return createInitialBlob(dept);
  if (result.statusCode === 304) return { notModified: true, etag: result.blob.etag };
  if (!result.stream) return createInitialBlob(dept);

  let parsed;
  try {
    parsed = JSON.parse(await new Response(result.stream).text());
  } catch {
    return createInitialBlob(dept); // unreadable blob — start it again
  }

  return {
    state: {
      version: 1,
      updatedAt: parsed.updatedAt || new Date().toISOString(),
      flows: (Array.isArray(parsed.flows) ? parsed.flows : []).map(normalizeFlow),
    },
    etag: result.blob.etag,
    notModified: false,
  };
}

export async function mutateFlows(dept, mutator, maxAttempts = MAX_ATTEMPTS) {
  let lastError;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const current = await readFlowsState({ dept });
    const next = await mutator(current.state.flows.map((flow) => JSON.parse(JSON.stringify(flow))));
    const nextState = { version: 1, updatedAt: new Date().toISOString(), flows: next.map(normalizeFlow) };
    try {
      const blob = await put(pathFor(dept), JSON.stringify(nextState), {
        access: "private",
        contentType: "application/json",
        allowOverwrite: true,
        addRandomSuffix: false,
        ifMatch: current.etag,
      });
      return { state: nextState, etag: blob.etag };
    } catch (error) {
      if (!isEtagConflict(error)) throw error;
      lastError = error;
      await backoff(attempt);
    }
  }

  // Fallback: re-apply to the newest copy and save unconditionally, so a
  // person's change never fails outright on a busy playbook.
  const latest = await readFlowsState({ dept });
  const finalFlows = await mutator(latest.state.flows.map((flow) => JSON.parse(JSON.stringify(flow))));
  const finalState = { version: 1, updatedAt: new Date().toISOString(), flows: finalFlows.map(normalizeFlow) };
  try {
    const blob = await put(pathFor(dept), JSON.stringify(finalState), {
      access: "private",
      contentType: "application/json",
      allowOverwrite: true,
      addRandomSuffix: false,
    });
    return { state: finalState, etag: blob.etag };
  } catch (error) {
    throw lastError || error;
  }
}

export function createFlow(data = {}) {
  const now = Date.now();
  return normalizeFlow({ ...data, id: id("flow"), createdAt: now, updatedAt: now });
}

export function updateFlow(existing, data = {}) {
  if (!existing) throw new Error("Playbook not found.");
  return normalizeFlow({
    ...existing,
    ...data,
    id: existing.id,
    createdAt: existing.createdAt,
    history: existing.history,
    updatedAt: Date.now(),
  });
}

// The log is append-only: who did what, when. The server stamps the actor and
// the time so a client can't claim either.
export function appendEvent(flow, event, actorId) {
  if (!event || !event.verb) return flow;
  const entry = normalizeEvent({ ...event, who: actorId, at: Date.now() });
  const history = [...(flow.history || []), entry].slice(-300);
  return { ...flow, history };
}

// A copy is a fresh run of the process, not a record of the old one: new ids,
// every status back to the start, no completion dates, no run clock.
export function reseedItems(items) {
  return (Array.isArray(items) ? items : []).map((item) => {
    if (item?.kind === "section") return normalizeSection({ ...item, id: id("sec") });
    const { taskId: _t, doneAt: _d, ...rest } = item || {};
    return normalizeStep({
      ...rest,
      id: id("step"),
      status: "todo",
      subtasks: (rest.subtasks || []).map((task) => ({ ...task, id: id("st"), done: false })),
    });
  });
}
