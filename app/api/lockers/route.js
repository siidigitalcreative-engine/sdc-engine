import { NextResponse } from "next/server";
import { addLocker, readLockers, removeLocker, updateLocker } from "../../lib/locker-store";
import { viewerScope } from "../../lib/scope";
import { getAuthenticatedMember } from "../../lib/auth-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (body, status = 200) => {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "private, no-cache");
  return response;
};

// Lockers belong to a department, like everything else here.
const visible = (lockers, scope) =>
  (scope.filterId ? lockers.filter((l) => (l.department || "sdc") === scope.filterId) : lockers);

export async function GET(request) {
  try {
    const actor = await getAuthenticatedMember(request);
    if (!actor) return json({ error: "Unauthorized." }, 401);

    const scope = await viewerScope(actor, request);
    const { state } = await readLockers();
    return json({
      lockers: visible(state.lockers, scope),
      scope: { departmentId: scope.departmentId, isAdmin: scope.isAdmin },
    });
  } catch (error) {
    console.error("GET /api/lockers", error);
    return json({ error: "Unable to load the lockers." }, 500);
  }
}

export async function POST(request) {
  try {
    const actor = await getAuthenticatedMember(request);
    if (!actor) return json({ error: "Unauthorized." }, 401);

    const scope = await viewerScope(actor, request);
    const body = await request.json();
    const state = await addLocker({
      ...body.locker,
      department: scope.isAdmin ? (scope.filterId || scope.departmentId) : scope.departmentId,
      createdBy: actor.id,
    });
    return json({ lockers: visible(state.lockers, scope) }, 201);
  } catch (error) {
    return json({ error: error.message || "Unable to create that locker." }, 400);
  }
}

export async function PATCH(request) {
  try {
    const actor = await getAuthenticatedMember(request);
    if (!actor) return json({ error: "Unauthorized." }, 401);

    const scope = await viewerScope(actor, request);
    const body = await request.json();
    const patch = { ...(body.patch || {}) };
    if (patch.department !== undefined && !scope.isAdmin) delete patch.department;

    const state = await updateLocker(body.id, patch);
    return json({ lockers: visible(state.lockers, scope) });
  } catch (error) {
    return json({ error: error.message || "Unable to save that locker." }, 400);
  }
}

export async function DELETE(request) {
  try {
    const actor = await getAuthenticatedMember(request);
    if (!actor) return json({ error: "Unauthorized." }, 401);

    const scope = await viewerScope(actor, request);
    const body = await request.json();
    const state = await removeLocker(body.id);
    return json({ lockers: visible(state.lockers, scope) });
  } catch (error) {
    return json({ error: error.message || "Unable to delete that locker." }, 400);
  }
}
