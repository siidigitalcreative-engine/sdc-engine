import { NextResponse } from "next/server";
import {
  DAY_END_MIN, DAY_START_MIN, SLOT_MIN,
  addBlock, clearDay, listBlocks, moveBlock, removeBlock,
} from "../../lib/time-block-store";
import { readMembersState, sanitizeMembers } from "../../lib/member-store";
import { departmentForMember, listDepartments } from "../../lib/department-store";
import { getAuthenticatedMember } from "../../lib/auth-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (body, status = 200) => {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "private, no-cache");
  return response;
};

/* Everyone in a department can see each other's day. An admin department may
   look at another department by passing ?department=. Writing is always
   limited to your own blocks, checked in the store. */
async function visibleMembers(actor, request) {
  const [department, departments, members] = await Promise.all([
    departmentForMember(actor), listDepartments(), readMembersState(),
  ]);
  const requested = new URL(request.url).searchParams.get("department");
  // Management / Admin / HOD Admin use accessLevel "admin" across the app.
  // Department ownership alone does not grant cross-department visibility.
  const isAdmin = String(actor?.accessLevel || "").trim() === "admin";
  const validRequested = requested === "all" || departments.some((d) => d.id === requested);
  const fallbackId = departments[0]?.id;
  const scopeId = isAdmin && requested && validRequested ? requested : (department?.id || fallbackId);

  const visible = scopeId === "all" ? members.state.members : members.state.members.filter(
    (m) => (m.department || fallbackId) === scopeId
  );
  return {
    department,
    departments: isAdmin ? departments : [],
    scopeId,
    members: sanitizeMembers(visible),
  };
}

export async function GET(request) {
  try {
    const actor = await getAuthenticatedMember(request);
    if (!actor) return json({ error: "Unauthorized." }, 401);

    const date = new URL(request.url).searchParams.get("date") || "";
    const scope = await visibleMembers(actor, request);
    const ids = new Set(scope.members.map((m) => m.id));
    const blocks = (await listBlocks(date)).filter((b) => ids.has(b.member));

    return json({
      date,
      blocks,
      members: scope.members,
      departments: scope.departments,
      departmentId: scope.scopeId,
      me: actor.id,
      day: { start: DAY_START_MIN, end: DAY_END_MIN, slot: SLOT_MIN },
    });
  } catch (error) {
    console.error("GET /api/time-blocks", error);
    return json({ error: "Unable to load the time blocks." }, 500);
  }
}

// Write responses are what the board renders next, so they are filtered the
// same way GET is: this date, and only the members this viewer can see.
async function visibleForDate(actor, request, state, date) {
  const scope = await visibleMembers(actor, request);
  const ids = new Set(scope.members.map((m) => m.id));
  return state.blocks.filter((b) => b.date === date && ids.has(b.member));
}

export async function POST(request) {
  try {
    const actor = await getAuthenticatedMember(request);
    if (!actor) return json({ error: "Unauthorized." }, 401);
    const body = await request.json();
    // The client sends the date alongside the block, so merge it in rather than
    // letting the store reject a block that looks dateless.
    const date = body.block?.date || body.date || "";
    const scope = await visibleMembers(actor, request);
    const allowed = new Set(scope.members.map((m) => m.id));

    /* Blocking for other people is limited to those the viewer can already see,
       and the author is always included. */
    const requested = Array.isArray(body.members) ? body.members.filter((id) => allowed.has(id)) : [];
    const members = [...new Set([actor.id, ...requested])];

    const result = await addBlock(actor.id, { ...(body.block || {}), date }, members);
    return json({ blocks: await visibleForDate(actor, request, result.state, date) }, 201);
  } catch (error) {
    return json({ error: error.message || "Unable to add that block." }, 400);
  }
}

export async function PATCH(request) {
  try {
    const actor = await getAuthenticatedMember(request);
    if (!actor) return json({ error: "Unauthorized." }, 401);
    const body = await request.json();
    const result = await moveBlock(actor.id, body.id, body);
    return json({ blocks: await visibleForDate(actor, request, result.state, body.date) });
  } catch (error) {
    return json({ error: error.message || "Unable to move that block." }, 400);
  }
}

export async function DELETE(request) {
  try {
    const actor = await getAuthenticatedMember(request);
    if (!actor) return json({ error: "Unauthorized." }, 401);
    const body = await request.json();
    const result = body.all
      ? await clearDay(actor.id, body.date)
      : await removeBlock(actor.id, body.id);
    return json({ blocks: await visibleForDate(actor, request, result.state, body.date) });
  } catch (error) {
    return json({ error: error.message || "Unable to remove that block." }, 400);
  }
}
