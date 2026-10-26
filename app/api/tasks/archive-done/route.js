import { NextResponse } from "next/server";
import { mutateTasks, readTasksState } from "../../../lib/task-store";
import { getAuthenticatedMember } from "../../../lib/auth-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body, status = 200, etag) {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "private, no-cache");
  if (etag) response.headers.set("ETag", etag);
  return response;
}

const isDone = (task) => String(task?.status) === "done";

// Clears the Done column on demand. Unlike the Monday cron, this takes
// everything currently in Done, including work finished today, because the
// button is meant to mirror what the person can see on the board.
export async function POST(request) {
  try {
    const actor = await getAuthenticatedMember(request);
    if (!actor) return json({ error: "Unauthorized." }, 401);

    const { state } = await readTasksState();
    const ids = new Set(
      state.tasks.filter((t) => t && !t.archived && isDone(t)).map((t) => String(t.id))
    );

    if (!ids.size) {
      return json({ archived: 0, tasks: state.tasks });
    }

    const result = await mutateTasks((tasks) =>
      tasks.map((t) => (ids.has(String(t.id)) ? { ...t, archived: true } : t))
    );

    return json({ archived: ids.size, tasks: result.state.tasks }, 200, result.etag);
  } catch (error) {
    console.error("POST /api/tasks/archive-done", error);
    return json({ error: error.message || "Unable to archive the completed tasks." }, 500);
  }
}
