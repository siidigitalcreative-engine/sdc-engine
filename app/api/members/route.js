import { NextResponse } from "next/server";
import {
  createMemberInput,
  mutateMembers,
  readMembersState,
  sanitizeMembers,
  updateMemberInput,
} from "../../lib/member-store";
import { createAuthToken, getAuthenticatedMember, setAuthCookie } from "../../lib/auth-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body, status = 200, etag) {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "private, no-cache");
  if (etag) response.headers.set("ETag", etag);
  return response;
}

export async function GET(request) {
  try {
    const currentEtag = request.headers.get("if-none-match") || undefined;
    const result = await readMembersState({ ifNoneMatch: currentEtag });

    if (result.notModified) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: result.etag,
          "Cache-Control": "private, no-cache",
        },
      });
    }

    let departments = [];
    try {
      const { listDepartments } = await import("../../lib/department-store");
      departments = (await listDepartments()).map((d) => ({ id: d.id, name: d.name, color: d.color }));
    } catch (error) {
      console.error("GET /api/members: departments unavailable", error);
    }

    /* This list is always whole. The sign-in screen needs it before anyone is
       signed in, and scoping it by the viewer's session meant the picker only
       showed whoever logged in last. Pages narrow it themselves: the Team page
       shows the viewer's own department and only an admin can switch. */
    const members = sanitizeMembers(result.state.members);

    const viewer = await getAuthenticatedMember(request);
    let scopeInfo = null;
    if (viewer) {
      const { viewerScope } = await import("../../lib/scope");
      const scope = await viewerScope(viewer, request);
      scopeInfo = { departmentId: scope.departmentId, level: scope.level, isAdmin: scope.isAdmin };
    }

    return json({ members, departments, scope: scopeInfo }, 200, result.etag);
  } catch (error) {
    console.error("GET /api/members", error);
    return json({ error: "Unable to load team members." }, 500);
  }
}

export async function POST(request) {
  try {
    const actor = await getAuthenticatedMember(request);
    if (!actor) return json({ error: "Unauthorized." }, 401);

    const body = await request.json();
    const newMember = createMemberInput(body);
    const result = await mutateMembers((members) => [...members, newMember]);

    return json({ members: sanitizeMembers(result.state.members), member: sanitizeMembers([newMember])[0] }, 201, result.etag);
  } catch (error) {
    console.error("POST /api/members", error);
    return json({ error: error.message || "Unable to add member." }, 400);
  }
}

export async function PATCH(request) {
  try {
    const actor = await getAuthenticatedMember(request);
    if (!actor) return json({ error: "Unauthorized." }, 401);

    const body = await request.json();
    const id = String(body.id || "");
    if (!id) return json({ error: "Member ID is required." }, 400);

    /* Only Management, Admin or HOD Admin may move someone to another
       department or change what they are allowed to do.

       The exception is a workspace with no admin at all: without it the first
       one could never be appointed, since granting the level would require
       already holding it. */
    const { viewerScope } = await import("../../lib/scope");
    const scope = await viewerScope(actor, request);
    const existing = await readMembersState();
    const hasAdmin = existing.state.members.some((m) => String(m.accessLevel || "").trim() === "admin");

    const data = { ...(body.data || {}) };
    if (!scope.isAdmin && hasAdmin) {
      delete data.department;
      delete data.accessLevel;
    }

    let updated = null;
    const result = await mutateMembers((members) => {
      const index = members.findIndex((member) => member.id === id);
      if (index < 0) throw new Error("Member not found.");
      updated = updateMemberInput(members[index], data);
      const next = [...members];
      next[index] = updated;
      return next;
    });

    const response = json({ members: sanitizeMembers(result.state.members), member: sanitizeMembers([updated])[0] }, 200, result.etag);
    if (updated?.id === actor.id) setAuthCookie(response, createAuthToken(updated));
    return response;
  } catch (error) {
    console.error("PATCH /api/members", error);
    return json({ error: error.message || "Unable to update member." }, 400);
  }
}

export async function DELETE(request) {
  try {
    const actor = await getAuthenticatedMember(request);
    if (!actor) return json({ error: "Unauthorized." }, 401);

    const body = await request.json();
    const id = String(body.id || "");
    if (!id) return json({ error: "Member ID is required." }, 400);

    if (id === actor.id) return json({ error: "You cannot delete the account you are currently signed in with." }, 400);

    const result = await mutateMembers((members) => {
      if (!members.some((member) => member.id === id)) throw new Error("Member not found.");
      return members.filter((member) => member.id !== id);
    });

    let departments = [];
    try {
      const { listDepartments } = await import("../../lib/department-store");
      departments = (await listDepartments()).map((d) => ({ id: d.id, name: d.name, color: d.color }));
    } catch (error) {
      console.error("GET /api/members: departments unavailable", error);
    }

    /* Signed out, this list is what the sign-in screen offers, so it stays
       whole. Signed in, it is scoped: everyone sees their own department,
       and only Management, Admin or HOD Admin sees another. */
    const viewer = await getAuthenticatedMember(request);
    let members = sanitizeMembers(result.state.members);
    let scopeInfo = null;

    if (viewer) {
      const { viewerScope } = await import("../../lib/scope");
      const scope = await viewerScope(viewer, request);
      const fallback = departments[0]?.id;
      // Settings asks for everyone with ?all=1; only an admin gets it.
      const wantsAll = new URL(request.url).searchParams.get("all") === "1" && scope.isAdmin;
      if (scope.filterId && !wantsAll) {
        members = members.filter((m) => (m.department || fallback) === scope.filterId);
      }
      scopeInfo = { departmentId: scope.departmentId, level: scope.level, isAdmin: scope.isAdmin };
    }

    return json({ members, departments, scope: scopeInfo }, 200, result.etag);
  } catch (error) {
    console.error("DELETE /api/members", error);
    return json({ error: error.message || "Unable to delete member." }, 400);
  }
}
