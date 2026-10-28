import { NextResponse } from "next/server";
import {
  PAGES, addDepartment, departmentForMember, listDepartments, removeDepartment, updateDepartment,
} from "../../lib/department-store";
import { readMembersState } from "../../lib/member-store";
import { getAuthenticatedMember } from "../../lib/auth-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (body, status = 200) => {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "private, no-cache");
  return response;
};

// Only a member of an admin department may change any of this.
async function requireAdmin(request) {
  const member = await getAuthenticatedMember(request);
  if (!member) return { error: json({ error: "Unauthorized." }, 401) };
  const department = await departmentForMember(member);
  if (!department?.admin) return { error: json({ error: "Only an admin department can change access." }, 403) };
  return { member, department };
}

async function payload() {
  const [departments, members] = await Promise.all([listDepartments(), readMembersState()]);
  const counts = {};
  members.state.members.forEach((m) => {
    const key = m.department || departments[0]?.id;
    counts[key] = (counts[key] || 0) + 1;
  });
  return { departments, pages: PAGES, counts };
}

export async function GET(request) {
  try {
    const member = await getAuthenticatedMember(request);
    if (!member) return json({ error: "Unauthorized." }, 401);
    return json(await payload());
  } catch (error) {
    console.error("GET /api/departments", error);
    return json({ error: "Unable to load departments." }, 500);
  }
}

export async function POST(request) {
  const gate = await requireAdmin(request);
  if (gate.error) return gate.error;
  try {
    const body = await request.json();
    await addDepartment(body.name);
    return json(await payload(), 201);
  } catch (error) {
    return json({ error: error.message || "Unable to add that department." }, 400);
  }
}

export async function PATCH(request) {
  const gate = await requireAdmin(request);
  if (gate.error) return gate.error;
  try {
    const body = await request.json();
    await updateDepartment(body.id, { name: body.name, color: body.color, admin: body.admin, pages: body.pages });
    return json(await payload());
  } catch (error) {
    return json({ error: error.message || "Unable to save that department." }, 400);
  }
}

export async function DELETE(request) {
  const gate = await requireAdmin(request);
  if (gate.error) return gate.error;
  try {
    const body = await request.json();
    const members = await readMembersState();
    const count = members.state.members.filter((m) => m.department === body.id).length;
    await removeDepartment(body.id, count);
    return json(await payload());
  } catch (error) {
    return json({ error: error.message || "Unable to remove that department." }, 400);
  }
}
