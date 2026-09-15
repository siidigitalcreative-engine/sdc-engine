import "server-only";

import {
  BlobPreconditionFailedError,
  get,
  put,
} from "@vercel/blob";
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";

const PATHNAME = "sdc/members.json";
const DEFAULT_PIN = "1234";

const DEFAULT_MEMBERS = [
  { id: "cn", i: "CN", name: "Che Navarro", role: "Digital Creative Lead", c: "#7C6FF0", loc: "Manila", projects: 6, open: 4, done: 12, status: "Active", featured: false },
  { id: "cq", i: "CQ", name: "Cha Quizon", role: "Multimedia Designer", c: "#E5536E", loc: "Parañaque", projects: 0, open: 0, done: 0, status: "Active", featured: false },
  { id: "jl", i: "JL", name: "Jules Lim", role: "Motion Designer", c: "#E0A93C", loc: "Manila", projects: 3, open: 2, done: 7, status: "Away", featured: false },
  { id: "sp", i: "SP", name: "Sofia Perez", role: "Content Lead", c: "#E5536E", loc: "Davao", projects: 5, open: 6, done: 14, status: "Active", featured: false },
  { id: "dt", i: "DT", name: "Diego Tan", role: "Web Developer", c: "#3E8ED0", loc: "Manila", projects: 4, open: 3, done: 11, status: "Active", featured: false },
];

function makeId() {
  return `member-${randomUUID()}`;
}

export function hashPin(pin) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(String(pin), salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPin(pin, stored) {
  try {
    const [salt, expectedHex] = String(stored || "").split(":");
    if (!salt || !expectedHex) return false;
    const expected = Buffer.from(expectedHex, "hex");
    const actual = scryptSync(String(pin), salt, expected.length);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

function initialsFromName(name = "") {
  return String(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "TM";
}

function normalizeStoredMember(member) {
  return {
    id: String(member.id || makeId()),
    i: String(member.i || initialsFromName(member.name)).trim().toUpperCase().slice(0, 3),
    name: String(member.name || "Team Member").trim(),
    role: String(member.role || "Creative Team").trim(),
    c: String(member.c || "#7C6FF0"),
    loc: String(member.loc || "Manila").trim(),
    projects: Math.max(0, Number(member.projects) || 0),
    open: Math.max(0, Number(member.open) || 0),
    done: Math.max(0, Number(member.done) || 0),
    status: String(member.status || "Active"),
    featured: Boolean(member.featured),
    pinHash: String(member.pinHash || hashPin(DEFAULT_PIN)),
  };
}

export function sanitizeMember(member) {
  if (!member) return null;
  const { pinHash, ...safe } = normalizeStoredMember(member);
  return safe;
}

export function sanitizeMembers(members) {
  return members.map(sanitizeMember);
}

function makeInitialState() {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    members: DEFAULT_MEMBERS.map((member) => ({
      ...normalizeStoredMember(member),
      pinHash: hashPin(DEFAULT_PIN),
    })),
  };
}

async function parseResult(result) {
  if (!result?.stream) return null;
  const text = await new Response(result.stream).text();
  const parsed = JSON.parse(text);
  return {
    version: 1,
    updatedAt: parsed.updatedAt || new Date().toISOString(),
    members: Array.isArray(parsed.members) ? parsed.members.map(normalizeStoredMember) : [],
  };
}

async function createInitialBlob() {
  const state = makeInitialState();
  const blob = await put(PATHNAME, JSON.stringify(state), {
    access: "private",
    contentType: "application/json",
    allowOverwrite: true,
  });
  return { state, etag: blob.etag };
}

export async function readMembersState({ ifNoneMatch } = {}) {
  const result = await get(PATHNAME, {
    access: "private",
    useCache: false,
    ifNoneMatch: ifNoneMatch || undefined,
  });

  if (!result) return createInitialBlob();

  if (result.statusCode === 304) {
    return { notModified: true, etag: result.blob.etag };
  }

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

export async function mutateMembers(mutator, maxAttempts = 8) {
  let lastError;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const current = await readMembersState();
    const draft = {
      ...current.state,
      members: current.state.members.map((member) => ({ ...member })),
    };

    const nextMembers = await mutator(draft.members);
    const nextState = {
      version: 1,
      updatedAt: new Date().toISOString(),
      members: nextMembers.map(normalizeStoredMember),
    };

    try {
      const blob = await put(PATHNAME, JSON.stringify(nextState), {
        access: "private",
        contentType: "application/json",
        allowOverwrite: true,
        ifMatch: current.etag,
      });
      return { state: nextState, etag: blob.etag };
    } catch (error) {
      if (!isEtagConflict(error)) throw error;
      lastError = error;
      await wait(25 * (attempt + 1));
    }
  }

  // If the same tiny member file is under unusually heavy contention, do one
  // final fresh read, re-apply the requested change, and save it. This keeps a
  // transient ETag conflict from becoming a user-facing save failure.
  const latest = await readMembersState();
  const finalMembers = await mutator(latest.state.members.map((member) => ({ ...member })));
  const finalState = {
    version: 1,
    updatedAt: new Date().toISOString(),
    members: finalMembers.map(normalizeStoredMember),
  };

  try {
    const blob = await put(PATHNAME, JSON.stringify(finalState), {
      access: "private",
      contentType: "application/json",
      allowOverwrite: true,
    });
    return { state: finalState, etag: blob.etag };
  } catch (error) {
    throw lastError || error;
  }
}

export function createMemberInput(data = {}) {
  const name = String(data.name || "").trim();
  const role = String(data.role || "").trim();
  const pin = String(data.pin || "").trim();

  if (!name) throw new Error("Member name is required.");
  if (!role) throw new Error("Role is required.");
  if (!/^\d{4,8}$/.test(pin)) throw new Error("PIN must be 4–8 digits.");

  return normalizeStoredMember({
    id: makeId(),
    i: String(data.i || initialsFromName(name)).toUpperCase().slice(0, 3),
    name,
    role,
    c: data.c,
    loc: data.loc,
    projects: data.projects,
    open: data.open,
    done: data.done,
    status: data.status,
    featured: false,
    pinHash: hashPin(pin),
  });
}

export function updateMemberInput(existing, data = {}) {
  if (!existing) throw new Error("Member not found.");

  const name = data.name === undefined ? existing.name : String(data.name).trim();
  const role = data.role === undefined ? existing.role : String(data.role).trim();
  if (!name) throw new Error("Member name is required.");
  if (!role) throw new Error("Role is required.");

  let pinHash = existing.pinHash;
  if (data.pin) {
    const pin = String(data.pin).trim();
    if (!/^\d{4,8}$/.test(pin)) throw new Error("PIN must be 4–8 digits.");
    pinHash = hashPin(pin);
  }

  return normalizeStoredMember({
    ...existing,
    ...data,
    id: existing.id,
    name,
    role,
    i: String(data.i || existing.i || initialsFromName(name)).toUpperCase().slice(0, 3),
    pinHash,
  });
}

export { DEFAULT_PIN };
