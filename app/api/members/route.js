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

    return json({ members: sanitizeMembers(result.state.members) }, 200, result.etag);
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

    let updated = null;
    const result = await mutateMembers((members) => {
      const index = members.findIndex((member) => member.id === id);
      if (index < 0) throw new Error("Member not found.");
      updated = updateMemberInput(members[index], body.data || {});
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

    return json({ members: sanitizeMembers(result.state.members) }, 200, result.etag);
  } catch (error) {
    console.error("DELETE /api/members", error);
    return json({ error: error.message || "Unable to delete member." }, 400);
  }
}
