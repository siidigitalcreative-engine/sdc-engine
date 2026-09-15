import "server-only";

import { BlobPreconditionFailedError, get, put } from "@vercel/blob";
import { randomUUID } from "node:crypto";

const PATHNAME = "sdc/calendar.json";

const DEFAULT_EVENTS = [
  { id: "seed-1", title: "Team content sync", calId: "meet", start: "2026-09-15T10:00:00.000+08:00", end: "2026-09-15T11:00:00.000+08:00", allDay: false, desc: "Weekly planning across all brands", attendees: ["cn"] },
  { id: "seed-2", title: "Quencha shoot review", calId: "shoots", start: "2026-09-15T14:00:00.000+08:00", end: "2026-09-15T15:30:00.000+08:00", allDay: false, desc: "", attendees: ["sp"] },
  { id: "seed-3", title: "CRYSALIS launch", calId: "deadline", start: "2026-09-16T00:00:00.000+08:00", end: "2026-09-16T00:00:00.000+08:00", allDay: true, desc: "Catalog rebrand goes live", attendees: [] },
  { id: "seed-4", title: "Design review — PRIMEO", calId: "design", start: "2026-09-16T11:00:00.000+08:00", end: "2026-09-16T12:00:00.000+08:00", allDay: false, desc: "", attendees: ["cn"] },
  { id: "seed-5", title: "Reel edits", calId: "content", start: "2026-09-14T09:30:00.000+08:00", end: "2026-09-14T11:00:00.000+08:00", allDay: false, desc: "", attendees: ["sp"] },
  { id: "seed-6", title: "Vendor call", calId: "meet", start: "2026-09-17T15:00:00.000+08:00", end: "2026-09-17T16:00:00.000+08:00", allDay: false, desc: "", attendees: ["jl", "cn"] },
  { id: "seed-7", title: "SCRUBZ copy", calId: "content", start: "2026-09-15T12:00:00.000+08:00", end: "2026-09-15T13:00:00.000+08:00", allDay: false, desc: "", attendees: [] },
];

function normalizeEvent(event = {}) {
  const start = new Date(event.start);
  const end = new Date(event.end);
  if (Number.isNaN(start.getTime())) throw new Error("Invalid event start date.");
  if (Number.isNaN(end.getTime())) throw new Error("Invalid event end date.");

  return {
    id: String(event.id || `event-${randomUUID()}`),
    title: String(event.title || "(No title)").trim() || "(No title)",
    calId: String(event.calId || "meet"),
    start: start.toISOString(),
    end: end.toISOString(),
    allDay: Boolean(event.allDay),
    desc: String(event.desc || ""),
    attendees: [...new Set(Array.isArray(event.attendees) ? event.attendees.map(String).filter(Boolean) : [])],
  };
}

function makeInitialState() {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    events: DEFAULT_EVENTS.map(normalizeEvent),
  };
}

async function parseResult(result) {
  if (!result?.stream) return null;
  const text = await new Response(result.stream).text();
  const parsed = JSON.parse(text);
  return {
    version: 1,
    updatedAt: parsed.updatedAt || new Date().toISOString(),
    events: Array.isArray(parsed.events) ? parsed.events.map(normalizeEvent) : [],
  };
}

async function createInitialBlob() {
  const state = makeInitialState();
  const blob = await put(PATHNAME, JSON.stringify(state), {
    access: "private",
    contentType: "application/json",
    allowOverwrite: true,
    cacheControlMaxAge: 60,
  });
  return { state, etag: blob.etag };
}

export async function readCalendarState({ ifNoneMatch } = {}) {
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

export async function mutateCalendar(mutator, maxAttempts = 8) {
  let lastError;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const current = await readCalendarState();
    const nextEvents = await mutator(current.state.events.map((event) => ({ ...event, attendees: [...event.attendees] })));
    const nextState = {
      version: 1,
      updatedAt: new Date().toISOString(),
      events: nextEvents.map(normalizeEvent),
    };

    try {
      const blob = await put(PATHNAME, JSON.stringify(nextState), {
        access: "private",
        contentType: "application/json",
        allowOverwrite: true,
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

  // Final availability fallback: re-read the newest state, re-apply the requested
  // mutation, then overwrite once. This is only reached after repeated ETag
  // conflicts and keeps a transient conflict from becoming a user-facing failure.
  const latest = await readCalendarState();
  const finalEvents = await mutator(latest.state.events.map((event) => ({ ...event, attendees: [...event.attendees] })));
  const finalState = {
    version: 1,
    updatedAt: new Date().toISOString(),
    events: finalEvents.map(normalizeEvent),
  };
  try {
    const blob = await put(PATHNAME, JSON.stringify(finalState), {
      access: "private",
      contentType: "application/json",
      allowOverwrite: true,
      cacheControlMaxAge: 60,
    });
    return { state: finalState, etag: blob.etag };
  } catch (error) {
    throw lastError || error;
  }
}

export function createCalendarEvent(data = {}) {
  return normalizeEvent({ ...data, id: `event-${randomUUID()}` });
}

export function updateCalendarEvent(existing, data = {}) {
  if (!existing) throw new Error("Event not found.");
  return normalizeEvent({ ...existing, ...data, id: existing.id });
}
