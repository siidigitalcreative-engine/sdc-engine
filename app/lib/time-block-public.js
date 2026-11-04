import "server-only";
import { get, put } from "@vercel/blob";
import { randomBytes } from "node:crypto";
import { readMembersState, sanitizeMembers } from "./member-store";
import { departmentForMember, listDepartments } from "./department-store";
import { listBlocks, DAY_START_MIN, DAY_END_MIN, SLOT_MIN } from "./time-block-store";
import { readTasksState } from "./task-store";

const INDEX_PATH = "sdc/time-block-public-shares.json";
const STORE_OPTIONS = { access: "private", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json", cacheControlMaxAge: 0 };
const validDate = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
const token = () => randomBytes(24).toString("hex");

async function readIndex() {
  const record = await get(INDEX_PATH, { access: "private", useCache: false, cacheControlMaxAge: 0 });
  if (!record?.stream) return { shares: [], etag: null };
  const body = JSON.parse(await new Response(record.stream).text());
  if (!Array.isArray(body.shares)) throw new Error("Public link settings are invalid. No changes were saved.");
  return { shares: body.shares, etag: record.blob.etag };
}

// Match the current private Time Blocking page's default department scope.
async function allowedMembers(owner) {
  const [department, departments, members] = await Promise.all([
    departmentForMember(owner), listDepartments(), readMembersState(),
  ]);
  const defaultId = departments[0]?.id;
  const scope = members.state.members.filter(m => (m.department || defaultId) === department?.id);
  return sanitizeMembers(scope);
}

export async function getPublicSettings(owner) {
  const index = await readIndex();
  const saved = index.shares.find(item => item.ownerId === owner.id);
  const members = await allowedMembers(owner);
  return { enabled: !!saved?.enabled, token: saved?.token || "", view: saved?.view && (saved.view === "all" || members.some(m => m.id === saved.view)) ? saved.view : "all" };
}

export async function setPublicSettings(owner, patch) {
  const allowed = await allowedMembers(owner);
  if (patch.view !== undefined && patch.view !== "all" && !allowed.some(m => m.id === patch.view)) {
    throw new Error("That person is outside your available team view.");
  }
  for (let attempt = 0; attempt < 8; attempt++) {
    const index = await readIndex();
    const old = index.shares.find(item => item.ownerId === owner.id);
    const next = {
      ownerId: owner.id,
      token: old?.token || token(),
      enabled: patch.enabled === undefined ? !!old?.enabled : patch.enabled === true,
      view: patch.view === undefined ? old?.view || "all" : patch.view,
      updatedAt: new Date().toISOString(),
    };
    const shares = [...index.shares.filter(item => item.ownerId !== owner.id), next];
    try {
      await put(INDEX_PATH, JSON.stringify({ version: 1, shares }), {
        ...STORE_OPTIONS,
        ...(index.etag ? { ifMatch: index.etag } : { allowOverwrite: false }),
      });
      return { enabled: next.enabled, view: next.view, token: next.token };
    } catch (error) {
      if (!/etag|precondition|already exists|overwrite/i.test(String(error.message))) throw error;
    }
  }
  throw new Error("Share settings were changed elsewhere. Please try again.");
}

export async function getPublicTimeline(shareToken, date) {
  if (!/^[a-f0-9]{48}$/.test(shareToken) || !validDate(date)) return null;
  const index = await readIndex();
  const share = index.shares.find(item => item.token === shareToken && item.enabled === true);
  if (!share) return null;
  const membersState = await readMembersState();
  const owner = membersState.state.members.find(m => m.id === share.ownerId);
  if (!owner) return null;
  const allowed = await allowedMembers(owner);
  const selected = share.view === "all" ? allowed : allowed.filter(m => m.id === share.view);
  if (!selected.length) return null;
  const ids = new Set(selected.map(m => m.id));
  const { state: taskState } = await readTasksState();
  const taskById = new Map(taskState.tasks.map(t => [String(t.id), t]));
  const subtaskById = new Map();
  for (const task of taskState.tasks) for (const subtask of task.subtasks || []) subtaskById.set(String(subtask.id), subtask);
  const blocks = (await listBlocks(date)).filter(b => ids.has(b.member)).map(b => ({
    id: b.id, member: b.member, start: b.start, end: b.end,
    title: !b.titleEdited && b.kind === "task" ? taskById.get(String(b.refId))?.title || b.title
      : !b.titleEdited && b.kind === "subtask" ? subtaskById.get(String(b.refId))?.title || b.title : b.title,
    project: b.project || "", color: b.color,
  }));
  return { date, view: share.view, members: selected, blocks, day: { start: DAY_START_MIN, end: DAY_END_MIN, slot: SLOT_MIN } };
}
