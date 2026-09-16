import "server-only";
import { readStatusesState } from "./status-store";
import { readMembersState } from "./member-store";

// Trim every env value — pasted tokens often carry a trailing space/newline,
// which silently breaks the API URL or the config check.
const clean = (v) => String(v || "").trim();

const LARK = clean(process.env.LARK_BASE_DOMAIN) || "https://open.larksuite.com";

// Field names as they appear in the Lark Base table (override via env if renamed).
const F_TITLE = clean(process.env.LARK_BASE_FIELD_TITLE) || "Tasks";
const F_DESC = clean(process.env.LARK_BASE_FIELD_DESC) || "Tasks Details";
const F_STATUS = clean(process.env.LARK_BASE_FIELD_STATUS) || "Task Status";
const F_DATE = clean(process.env.LARK_BASE_FIELD_DATE) || "Date";
const F_ASSIGNEES = clean(process.env.LARK_BASE_FIELD_ASSIGNEES) || "Assignee"; // Multiple Options (multi-select) column

const APP_ID = clean(process.env.LARK_APP_ID);
const APP_SECRET = clean(process.env.LARK_APP_SECRET);
const APP_TOKEN = clean(process.env.LARK_BASE_APP_TOKEN);
const WIKI_TOKEN = clean(process.env.LARK_BASE_WIKI_TOKEN);
const TABLE_ID = clean(process.env.LARK_BASE_TABLE_ID);

export function isBaseConfigured() {
  return Boolean(APP_ID && APP_SECRET && TABLE_ID && (APP_TOKEN || WIKI_TOKEN));
}

async function getToken() {
  const res = await fetch(`${LARK}/open-apis/auth/v3/tenant_access_token/internal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app_id: APP_ID, app_secret: APP_SECRET }),
  });
  const data = await res.json().catch(() => ({}));
  if (!data.tenant_access_token) throw new Error(`Lark token failed — check LARK_APP_ID / LARK_APP_SECRET (${data.msg || JSON.stringify(data)})`);
  return data.tenant_access_token;
}

// Prefer the direct Base app_token. Only fall back to resolving a wiki node
// token (for wiki-hosted Bases) when no app_token is provided.
let cachedAppToken = APP_TOKEN || null;
async function resolveAppToken(token) {
  if (cachedAppToken) return cachedAppToken;
  if (!WIKI_TOKEN) throw new Error("Missing LARK_BASE_APP_TOKEN or LARK_BASE_WIKI_TOKEN.");
  const res = await fetch(`${LARK}/open-apis/wiki/v2/spaces/get_node?token=${encodeURIComponent(WIKI_TOKEN)}&obj_type=wiki`, {
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

// Diagnostic probe — reports config (no secrets) and does a live read against
// the Base so the exact Lark error (permission / field / token) is visible.
export async function baseProbe() {
  const cfg = {
    hasAppId: Boolean(APP_ID),
    hasSecret: Boolean(APP_SECRET),
    hasTable: Boolean(TABLE_ID),
    hasAppToken: Boolean(APP_TOKEN),
    hasWiki: Boolean(WIKI_TOKEN),
    configured: isBaseConfigured(),
  };
  if (!cfg.configured) return { ...cfg, ok: false, step: "config", error: "Missing one or more env vars." };
  try {
    const token = await getToken();
    const appToken = await resolveAppToken(token);
    const res = await fetch(`${LARK}/open-apis/bitable/v1/apps/${appToken}/tables/${TABLE_ID}/records?page_size=1`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => ({}));
    if (data.code !== 0) {
      return { ...cfg, ok: false, step: "read", code: data.code, error: data.msg || JSON.stringify(data), appTokenPrefix: String(appToken).slice(0, 6) };
    }
    return { ...cfg, ok: true, step: "read", records: data?.data?.total ?? (data?.data?.items?.length ?? 0), appTokenPrefix: String(appToken).slice(0, 6) };
  } catch (e) {
    return { ...cfg, ok: false, step: "exception", error: String(e.message || e) };
  }
}
