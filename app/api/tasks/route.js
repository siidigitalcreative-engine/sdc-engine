import { NextResponse } from "next/server";
import { filterTasks, viewerScope } from "../../lib/scope";
import { getAuthenticatedMember } from "../../lib/auth-token";
import {
  createTask,
  mutateTasks,
  readTasksState,
  updateTask,
} from "../../lib/task-store";
import { isBaseConfigured, syncCreate, syncUpdate, syncDelete } from "../../lib/lark-base";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body, status = 200, etag) {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate");
  if (etag) response.headers.set("ETag", etag);
  return response;
}

async function requireAuth(request) {
  return getAuthenticatedMember(request);
}

export async function GET(request) {
  try {
    const actor = await requireAuth(request);
    if (!actor) return json({ error: "Unauthorized." }, 401);

    const currentEtag = request.headers.get("if-none-match") || undefined;
    const result = await readTasksState({ ifNoneMatch: currentEtag });

    if (result.notModified) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: result.etag,
          "Cache-Control": "private, no-cache, no-store, must-revalidate",
        },
      });
    }

    // Only this member's department, unless they are in an admin department.
    const scope = await viewerScope(actor, request);
    return json({ tasks: filterTasks(result.state.tasks, scope), scope: { departmentId: scope.departmentId, isAdmin: scope.isAdmin } }, 200, result.etag);
  } catch (error) {
    console.error("GET /api/tasks", error);
    return json({ error: "Unable to load tasks." }, 500);
  }
}

export async function POST(request) {
  try {
    const actor = await requireAuth(request);
    if (!actor) return json({ error: "Unauthorized." }, 401);

    const body = await request.json();
    const scope = await viewerScope(actor, request);
    const incoming = body.data || body;
    const task = createTask({
      ...incoming,
      department: scope.isAdmin && incoming.department ? incoming.department : scope.departmentId,
    });
    if (isBaseConfigured()) {
      try { const recordId = await syncCreate(task); if (recordId) task.larkRecordId = recordId; }
      catch (e) { console.error("Lark Base create sync failed", e); }
    }
    const result = await mutateTasks((tasks) => [...tasks, task]);
    return json({ tasks: filterTasks(result.state.tasks, scope), task }, 201, result.etag);
  } catch (error) {
    console.error("POST /api/tasks", error);
    return json({ error: error.message || "Unable to create task." }, 400);
  }
}

export async function PATCH(request) {
  try {
    const actor = await requireAuth(request);
    if (!actor) return json({ error: "Unauthorized." }, 401);

    const body = await request.json();
    const id = String(body.id || "");
    if (!id) return json({ error: "Task ID is required." }, 400);

    let updated = null;
    const result = await mutateTasks((tasks) => {
      const index = tasks.findIndex((task) => String(task.id) === id);
      if (index < 0) throw new Error("Task not found.");
      updated = updateTask(tasks[index], body.data || {});
      const next = [...tasks];
      next[index] = updated;
      return next;
    });

    if (isBaseConfigured() && updated) {
      try {
        if (updated.larkRecordId) {
          await syncUpdate(updated);
        } else {
          const recordId = await syncCreate(updated);
          if (recordId) {
            updated = { ...updated, larkRecordId: recordId };
            await mutateTasks((tasks) => tasks.map((t) => (String(t.id) === id ? { ...t, larkRecordId: recordId } : t)));
          }
        }
      } catch (e) { console.error("Lark Base update sync failed", e); }
    }

    const scope = await viewerScope(actor, request);
    return json({ tasks: filterTasks(result.state.tasks, scope), task: updated }, 200, result.etag);
  } catch (error) {
    console.error("PATCH /api/tasks", error);
    return json({ error: error.message || "Unable to update task." }, 400);
  }
}

export async function DELETE(request) {
  try {
    const actor = await requireAuth(request);
    if (!actor) return json({ error: "Unauthorized." }, 401);

    const body = await request.json();
    const id = String(body.id || "");
    if (!id) return json({ error: "Task ID is required." }, 400);

    if (isBaseConfigured()) {
      try {
        const { state } = await readTasksState();
        const target = state.tasks.find((task) => String(task.id) === id);
        if (target?.larkRecordId) await syncDelete(target.larkRecordId);
      } catch (e) { console.error("Lark Base delete sync failed", e); }
    }

    const result = await mutateTasks((tasks) => {
      if (!tasks.some((task) => String(task.id) === id)) throw new Error("Task not found.");
      return tasks.filter((task) => String(task.id) !== id);
    });

    // Only this member's department, unless they are in an admin department.
    const scope = await viewerScope(actor, request);
    return json({ tasks: filterTasks(result.state.tasks, scope), scope: { departmentId: scope.departmentId, isAdmin: scope.isAdmin } }, 200, result.etag);
  } catch (error) {
    console.error("DELETE /api/tasks", error);
    return json({ error: error.message || "Unable to delete task." }, 400);
  }
}
