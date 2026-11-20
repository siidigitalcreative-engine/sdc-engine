import { NextResponse } from "next/server";
import { getAuthenticatedMember } from "../../../lib/auth-token";
import { activeDept, canManageDept, isAdmin } from "../../../lib/access";
import { listDepartments, publicDepartment } from "../../../lib/department-store";
import { loginMember, readMembersState } from "../../../lib/member-store";
import { readStatusesState } from "../../../lib/status-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (body, status = 200) => {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
};

// Short code for the badge on a playbook card: "Digital Creative" -> DC,
// "Marketing" -> M, "E-commerce" -> E.
function shortCode(name) {
  const words = String(name || "").split(/[\s/&-]+/).filter(Boolean);
  if (words.length > 1) return words.slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return String(name || "?").slice(0, 2).replace(/[^a-z]/gi, "").toUpperCase() || "?";
}

// Everything Plug & Play needs before it can draw: the department list for the
// library switcher and the department badges, a name-and-initials roster so a
// step can be assigned to someone in another department, and the statuses of
// the department that owns the playbook.
//
// The roster is the same slim shape the login picker already serves
// (id, initials, name, role, colour, department) — no contact details, no PINs.
export async function GET(request) {
  try {
    const actor = await getAuthenticatedMember(request);
    if (!actor) return json({ error: "Unauthorized." }, 401);

    const dept = await activeDept(request, actor);
    const departments = await listDepartments();
    const { state } = await readMembersState();
    const statuses = await readStatusesState({ dept });

    return json({
      activeDept: dept,
      departments: departments.map((d) => ({ ...publicDepartment(d), short: shortCode(d.name) })),
      people: state.members.map(loginMember),
      statuses: statuses.state.statuses,
      // Departments whose plug library this person may edit.
      manageable: departments.filter((d) => canManageDept(actor, d.id)).map((d) => d.id),
      isAdmin: isAdmin(actor),
      me: actor.id,
    });
  } catch (error) {
    console.error("GET /api/plugplay/meta", error);
    return json({ error: `Workspace details: ${error?.message || error}` }, 500);
  }
}
