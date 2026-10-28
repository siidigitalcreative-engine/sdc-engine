import "server-only";

import { BlobPreconditionFailedError, get, put } from "@vercel/blob";

const PATHNAME = "sdc/departments.json";

/* The pages access can be granted to. Add a page here and it appears in the
   access matrix on its own; nothing else needs changing. */
export const PAGES = [
  { id: "dashboard", name: "Dashboard",    href: "/dashboard", note: "Today's tasks and the daily digest", always: true },
  { id: "calendar",  name: "Calendar",     href: "/calendar",  note: "Schedule and events" },
  { id: "tasks",     name: "Tasks",        href: "/tasks",     note: "Board, list and the archive" },
  { id: "projects",  name: "Projects",     href: "/projects",  note: "Project list and overview export" },
  { id: "print",     name: "Print Hub",    href: "/print",     note: "Print records, speeds and exports" },
  { id: "ads",       name: "Ads",          href: "/ads",       note: "Campaigns, pillars and budgets" },
  { id: "team",      name: "Team Members", href: "/team",      note: "People and their stats" },
  { id: "lark",      name: "Lark Groups",  href: "/lark",      note: "Where exports get sent" },
  { id: "reports",   name: "Reports",      href: "/reports",   note: "Reporting" },
  { id: "settings",  name: "Settings",     href: "/settings",  note: "Departments, access and app settings", adminOnly: true },
];

const PAGE_IDS = PAGES.map((p) => p.id);
export const DEFAULT_DEPARTMENT_ID = "sdc";

// Seeded so nobody is locked out on the first load: one admin department that
// can reach everything.
const DEFAULTS = [
  { id: DEFAULT_DEPARTMENT_ID, name: "Digital Creative (SDC)", color: "#F0784B", admin: true, pages: [...PAGE_IDS] },
];

const clean = (v) => String(v ?? "").trim().replace(/\s+/g, " ");
const makeId = () => `dept-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

function normalizeDepartment(dept) {
  const pages = Array.isArray(dept?.pages)
    ? [...new Set(dept.pages.map(clean).filter((p) => PAGE_IDS.includes(p)))]
    : [];
  if (!pages.includes("dashboard")) pages.unshift("dashboard");   // everyone needs a landing page
  return {
    id: clean(dept?.id) || makeId(),
    name: clean(dept?.name).slice(0, 60) || "Department",
    color: /^#[0-9a-f]{6}$/i.test(String(dept?.color)) ? dept.color : "#7C6FF0",
    admin: Boolean(dept?.admin),
    pages,
  };
}

function normalizeState(raw) {
  const seen = new Set();
  let departments = (Array.isArray(raw?.departments) ? raw.departments : DEFAULTS)
    .map(normalizeDepartment)
    .filter((d) => (seen.has(d.id) ? false : seen.add(d.id)));

  if (!departments.length) departments = DEFAULTS.map(normalizeDepartment);
  // At least one admin department, or the Settings page becomes unreachable.
  if (!departments.some((d) => d.admin)) departments[0].admin = true;

  return { version: 1, updatedAt: raw?.updatedAt || new Date().toISOString(), departments };
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
  const state = normalizeState({ departments: DEFAULTS });
  const blob = await put(PATHNAME, JSON.stringify(state), WRITE_OPTS);
  return { state, etag: blob.etag };
}

export async function readDepartmentsState() {
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
    const current = await readDepartmentsState();
    const next = normalizeState({
      departments: await mutator(current.state.departments.map((d) => ({ ...d, pages: [...d.pages] }))),
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
  const latest = await readDepartmentsState();
  const finalState = normalizeState({
    departments: await mutator(latest.state.departments.map((d) => ({ ...d, pages: [...d.pages] }))),
    updatedAt: new Date().toISOString(),
  });
  try {
    const blob = await put(PATHNAME, JSON.stringify(finalState), WRITE_OPTS);
    return { state: finalState, etag: blob.etag };
  } catch (error) {
    throw lastError || error;
  }
}

export async function listDepartments() {
  const { state } = await readDepartmentsState();
  return state.departments;
}

export async function addDepartment(name) {
  const value = clean(name).slice(0, 60);
  if (!value) throw new Error("A department name is required.");
  return mutate((departments) => {
    if (departments.some((d) => d.name.toLowerCase() === value.toLowerCase())) {
      throw new Error("That department already exists.");
    }
    if (departments.length >= 20) throw new Error("That is as many departments as this list holds.");
    return [...departments, { id: makeId(), name: value, color: "#7C6FF0", admin: false, pages: ["dashboard"] }];
  });
}

export async function updateDepartment(id, { name, color, admin, pages } = {}) {
  const target = clean(id);
  return mutate((departments) => {
    const found = departments.find((d) => d.id === target);
    if (!found) throw new Error("That department no longer exists.");

    if (name !== undefined) {
      const value = clean(name).slice(0, 60);
      if (!value) throw new Error("A department name is required.");
      if (departments.some((d) => d.id !== target && d.name.toLowerCase() === value.toLowerCase())) {
        throw new Error("That department already exists.");
      }
      found.name = value;
    }
    if (color !== undefined && /^#[0-9a-f]{6}$/i.test(String(color))) found.color = color;
    if (admin !== undefined) {
      const next = Boolean(admin);
      if (!next && found.admin && departments.filter((d) => d.admin).length === 1) {
        throw new Error("Keep at least one admin department, or Settings becomes unreachable.");
      }
      found.admin = next;
    }
    if (pages !== undefined) {
      found.pages = [...new Set((Array.isArray(pages) ? pages : []).map(clean).filter((p) => PAGE_IDS.includes(p)))];
    }
    return departments;
  });
}

export async function removeDepartment(id, memberCount = 0) {
  const target = clean(id);
  if (memberCount > 0) {
    throw new Error(`That department still has ${memberCount} member${memberCount === 1 ? "" : "s"}. Move them first.`);
  }
  return mutate((departments) => {
    const found = departments.find((d) => d.id === target);
    if (!found) throw new Error("That department no longer exists.");
    if (departments.length === 1) throw new Error("Keep at least one department.");
    if (found.admin && departments.filter((d) => d.admin).length === 1) {
      throw new Error("That is the only admin department. Make another one admin first.");
    }
    return departments.filter((d) => d.id !== target);
  });
}

/* ---- access ---- */

export function departmentCanOpen(department, pageId) {
  const page = PAGES.find((p) => p.id === pageId);
  if (!page) return false;
  if (page.always) return true;                     // a landing page for everyone
  if (page.adminOnly) return Boolean(department?.admin);
  return Boolean(department?.pages?.includes(pageId));
}

// The department a member belongs to, falling back to the first one so an
// existing member without a department is never locked out.
export async function departmentForMember(member) {
  const { state } = await readDepartmentsState();
  const byId = state.departments.find((d) => d.id === clean(member?.department));
  return byId || state.departments[0];
}

export async function memberCanOpen(member, pageId) {
  const department = await departmentForMember(member);
  return departmentCanOpen(department, pageId);
}
