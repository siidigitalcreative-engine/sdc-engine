import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* A one-off check that runs the Tasks read one stage at a time and reports
   which stage fails. Open /api/diagnose in the browser and read the JSON.
   Safe to delete once the problem is found. */
export async function GET(request) {
  const steps = [];
  const run = async (name, fn) => {
    try {
      const value = await fn();
      steps.push({ step: name, ok: true, value });
      return value;
    } catch (error) {
      steps.push({ step: name, ok: false, error: String(error?.message || error) });
      return null;
    }
  };

  const actor = await run("auth", async () => {
    const { getAuthenticatedMember } = await import("../../lib/auth-token");
    const member = await getAuthenticatedMember(request);
    return member ? { id: member.id, name: member.name, department: member.department || null } : null;
  });

  await run("read tasks blob", async () => {
    const { readTasksState } = await import("../../lib/task-store");
    const result = await readTasksState();
    return { tasks: result.state.tasks.length, archived: result.state.tasks.filter((t) => t.archived).length };
  });

  await run("read departments blob", async () => {
    const { listDepartments } = await import("../../lib/department-store");
    const list = await listDepartments();
    return list.map((d) => ({ id: d.id, name: d.name, admin: d.admin }));
  });

  await run("read members blob", async () => {
    const { readMembersState } = await import("../../lib/member-store");
    const result = await readMembersState();
    return result.state.members.map((m) => ({ id: m.id, name: m.name, department: m.department || null }));
  });

  await run("resolve scope", async () => {
    if (!actor) throw new Error("No signed-in member, so scope cannot be resolved.");
    const { viewerScope } = await import("../../lib/scope");
    const scope = await viewerScope(actor, request);
    return { departmentId: scope.departmentId, isAdmin: scope.isAdmin, filterId: scope.filterId };
  });

  await run("filter tasks", async () => {
    if (!actor) throw new Error("No signed-in member.");
    const { readTasksState } = await import("../../lib/task-store");
    const { viewerScope, filterTasks } = await import("../../lib/scope");
    const result = await readTasksState();
    const scope = await viewerScope(actor, request);
    const visible = filterTasks(result.state.tasks, scope);
    const byDepartment = {};
    result.state.tasks.forEach((t) => {
      const key = t.department || "(none)";
      byDepartment[key] = (byDepartment[key] || 0) + 1;
    });
    return { total: result.state.tasks.length, visible: visible.length, byDepartment };
  });

  const failed = steps.find((s) => !s.ok);
  return NextResponse.json(
    { ok: !failed, firstFailure: failed ? failed.step : null, steps },
    { headers: { "Cache-Control": "no-store" } }
  );
}
