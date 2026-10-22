import { NextResponse } from "next/server";
import { mutateTasks, readTasksState } from "../../../lib/task-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Manila is UTC+8 year-round (no DST), so a fixed offset is safe here.
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

// UTC instant of this week's Monday 00:00 Manila time.
function manilaWeekStartUTC(now = new Date()) {
  const local = new Date(now.getTime() + MANILA_OFFSET_MS);
  const daysSinceMonday = (local.getUTCDay() + 6) % 7; // Sun=0 -> 6, Mon=1 -> 0
  const mondayMidnight = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate() - daysSinceMonday,
    0, 0, 0, 0
  );
  return mondayMidnight - MANILA_OFFSET_MS;
}

// doneAt is a number (ms). start/due are "YYYY-MM-DD" wall-clock dates.
function toMs(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const text = String(value).trim();
  const ms = /^\d{4}-\d{2}-\d{2}$/.test(text)
    ? Date.parse(`${text}T00:00:00+08:00`)
    : Date.parse(text);
  return Number.isNaN(ms) ? null : ms;
}

// Fall back for legacy Done tasks created before doneAt existed.
function completedAt(task) {
  return toMs(task.doneAt) ?? toMs(task.due) ?? toMs(task.start) ?? 0;
}

function isEligible(task, weekStart) {
  if (!task || task.archived) return false;
  if (String(task.status) !== "done") return false;
  return completedAt(task) < weekStart;
}

function authorized(request) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") || "";
  const agent = (request.headers.get("user-agent") || "").toLowerCase();
  if (secret) {
    if (header === `Bearer ${secret}`) return true;
    if (new URL(request.url).searchParams.get("key") === secret) return true;
  }
  return agent.includes("vercel-cron");
}

async function notifyLark(count, weekStart) {
  const webhook = process.env.LARK_TASKS_BOT_WEBHOOK || process.env.LARK_CALENDAR_BOT_WEBHOOK;
  if (!webhook || count < 1) return;

  const prevMonday = new Date(weekStart + MANILA_OFFSET_MS - 7 * 86400000)
    .toISOString()
    .slice(0, 10);

  try {
    await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        msg_type: "text",
        content: {
          text: `Weekly cleanup — archived ${count} completed task${count === 1 ? "" : "s"} from the week of ${prevMonday}.`,
        },
      }),
    });
  } catch (error) {
    console.error("archive-done: Lark notify failed", error);
  }
}

async function run(request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";
    const weekStart = manilaWeekStartUTC();

    const { state } = await readTasksState();
    const eligible = state.tasks.filter((task) => isEligible(task, weekStart));
    const ids = new Set(eligible.map((task) => String(task.id)));

    if (!dryRun && ids.size) {
      await mutateTasks((tasks) =>
        tasks.map((task) => (ids.has(String(task.id)) ? { ...task, archived: true } : task))
      );
      await notifyLark(ids.size, weekStart);
    }

    return NextResponse.json(
      {
        ok: true,
        dryRun,
        weekStartManila: new Date(weekStart + MANILA_OFFSET_MS).toISOString().slice(0, 16),
        scanned: state.tasks.length,
        archived: dryRun ? 0 : ids.size,
        eligible: eligible.map((task) => ({
          id: task.id,
          title: task.title,
          project: task.project,
          doneAt: task.doneAt ?? null,
        })),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("GET /api/cron/archive-done", error);
    return NextResponse.json({ error: "Unable to archive completed tasks." }, { status: 500 });
  }
}

export async function GET(request) {
  return run(request);
}

export async function POST(request) {
  return run(request);
}
