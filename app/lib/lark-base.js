import "server-only";
import { readStatusesState } from "./status-store";
import { readMembersState } from "./member-store";

const LARK = process.env.LARK_BASE_DOMAIN || "https://open.larksuite.com";

// Field names as they appear in the Lark Base table (override via env if renamed).
const F_TITLE = process.env.LARK_BASE_FIELD_TITLE || "Tasks";
const F_DESC = process.env.LARK_BASE_FIELD_DESC || "Tasks Details";
const F_STATUS = process.env.LARK_BASE_FIELD_STATUS || "Task Status";
const F_DATE = process.env.LARK_BASE_FIELD_DATE || "Date";
const F_ASSIGNEES = process.env.LARK_BASE_FIELD_ASSIGNEES || "Assignee"; // Multiple Options (multi-select) column

const TABLE_ID = process.env.LARK_BASE_TABLE_ID || "";

export function isBaseConfigured() {
  return Boolean(
    process.env.LARK_APP_ID &&
    process.env.LARK_APP_SECRET &&
    TABLE_ID &&
    (process.env.LARK_BASE_APP_TOKEN || process.env.LARK_BASE_WIKI_TOKEN)
  );
}

async function getToken() {
  const res = await fetch(`${LARK}/open-apis/auth/v3/tenant_access_token/internal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app_id: process.env.LARK_APP_ID, app_secret: process.env.LARK_APP_SECRET }),
  });
  const data = await res.json().catch(() => ({}));
  if (!data.tenant_access_token) throw new Error(`Lark token failed — check LARK_APP_ID / LARK_APP_SECRET (${data.msg || JSON.stringify(data)})`);
  return data.tenant_access_token;
}

// The Base lives inside a Wiki, so the URL token is a wiki node token, not the
// Base app_token. Resolve it once and cache it for this server instance.
let cachedAppToken = process.env.LARK_BASE_APP_TOKEN || null;
async function resolveAppToken(token) {
  if (cachedAppToken) return cachedAppToken;
  const wiki = process.env.LARK_BASE_WIKI_TOKEN;
  if (!wiki) throw new Error("Missing LARK_BASE_APP_TOKEN or LARK_BASE_WIKI_TOKEN.");
  const res = await fetch(`${LARK}/open-apis/wiki/v2/spaces/get_node?token=${encodeURIComponent(wiki)}&obj_type=wiki`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  const objToken = data?.data?.node?.obj_token;
  if (!objToken) throw new Error(`Could not resolve Base from wiki token — the app needs wiki read access (${data.msg || JSON.stringify(data)})`);
  cachedAppToken = objToken;
  return objToken;
}

async function statusNameFor(statusId) {
  try {
    const { state } = await readStatusesState();
    const found = (state.statuses || []).find((s) => s.id === statusId);
    if (found) return found.name;
  } catch { /* fall through */ }
  return String(statusId || "To Do");
}

async function assigneeNamesFor(refs) {
  const list = Array.isArray(refs) ? refs : [];
  if (!list.length) return [];
  let members = [];
  try { members = (await readMembersState()).state.members || []; } catch { members = []; }
  const map = {};
  for (const m of members) {
    const name = m.name || m.i || m.id;
    for (const key of [m.id, m.i, String(m.id || "").toLowerCase(), String(m.i || "").toLowerCase()]) {
      if (key) map[key] = name;
    }
  }
  const seen = new Set();
  const names = [];
  for (const ref of list) {
    const name = map[ref] || map[String(ref).toLowerCase()] || String(ref);
    if (name && !seen.has(name)) { seen.add(name); names.push(name); }
  }
  return names;
}

function dateToMs(ymd) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(ymd || ""))) return null;
  const ms = Date.parse(`${ymd}T00:00:00Z`);
  return Number.isFinite(ms) ? ms : null;
}

async function buildFields(task) {
  const fields = {
    [F_TITLE]: String(task.title || "Untitled task"),
    [F_DESC]: String(task.desc || ""),
    [F_STATUS]: await statusNameFor(task.status),   // single-select; Lark auto-adds new options
  };
  const ms = dateToMs(task.start);
  if (ms != null) fields[F_DATE] = ms;
  if (F_ASSIGNEES) {
    // Multiple Options field expects an array of option names; Lark auto-adds new ones.
    fields[F_ASSIGNEES] = await assigneeNamesFor(task.assignees);
  }
  return fields;
}

async function base() {
  const token = await getToken();
  const appToken = await resolveAppToken(token);
  return { token, url: `${LARK}/open-apis/bitable/v1/apps/${appToken}/tables/${TABLE_ID}/records` };
}

// Create a Base record for a task. Returns the new record_id (or null on failure).
export async function syncCreate(task) {
  const { token, url } = await base();
  const fields = await buildFields(task);
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
  });
  const data = await res.json().catch(() => ({}));
  if (data.code !== 0 || !data?.data?.record?.record_id) {
    throw new Error(`Base create failed (${data.msg || JSON.stringify(data)})`);
  }
  return data.data.record.record_id;
}

// Update the Base record for a task. Returns true on success.
export async function syncUpdate(task) {
  if (!task.larkRecordId) return false;
  const { token, url } = await base();
  const fields = await buildFields(task);
  const res = await fetch(`${url}/${task.larkRecordId}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
  });
  const data = await res.json().catch(() => ({}));
  if (data.code !== 0) throw new Error(`Base update failed (${data.msg || JSON.stringify(data)})`);
  return true;
}

// Delete the Base record for a task. Returns true on success.
export async function syncDelete(recordId) {
  if (!recordId) return false;
  const { token, url } = await base();
  const res = await fetch(`${url}/${recordId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (data.code !== 0) throw new Error(`Base delete failed (${data.msg || JSON.stringify(data)})`);
  return true;
}
