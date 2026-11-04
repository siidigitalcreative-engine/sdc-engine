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
  const scopeId = department?.admin && requested ? requested : department?.id;
  const fallbackId = departments[0]?.id;

  const visible = members.state.members.filter(
    (m) => (m.department || fallbackId) === scopeId
  );
  return {
    department,
    departments: department?.admin ? departments : [],
    scopeId,
    members: sanitizeMembers(visible.length ? visible : members.state.members),
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

export async function POST(request) {
  try {
    const actor = await getAuthenticatedMember(request);
    if (!actor) return json({ error: "Unauthorized." }, 401);
    const body = await request.json();
    const result = await addBlock(actor.id, body.block || {});
    return json({ blocks: result.state.blocks.filter((b) => b.date === (body.block?.date || "")) }, 201);
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
    return json({ blocks: result.state.blocks.filter((b) => b.date === body.date) });
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
    return json({ blocks: result.state.blocks.filter((b) => b.date === body.date) });
  } catch (error) {
    return json({ error: error.message || "Unable to remove that block." }, 400);
  }
}
