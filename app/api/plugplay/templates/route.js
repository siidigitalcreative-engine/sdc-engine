import { NextResponse } from "next/server";
import { getAuthenticatedMember } from "../../../lib/auth-token";
import { activeDept, canManageDept } from "../../../lib/access";
import { getDepartment } from "../../../lib/department-store";
import { readTemplatesState, writeTemplates } from "../../../lib/flow-template-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (body, status = 200) => {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
};

async function resolveDept(request, actor, wanted) {
  if (!wanted) return activeDept(request, actor);
  const department = await getDepartment(String(wanted));
  if (!department) throw new Error("Department not found.");
  return department.id;
}

// Any signed-in person can read any department's plugs — a playbook is built
// from other departments' steps, so the library has to switch between them.
export async function GET(request) {
  try {
    const actor = await getAuthenticatedMember(request);
    if (!actor) return json({ error: "Unauthorized." }, 401);

    const wanted = new URL(request.url).searchParams.get("dept");
    const dept = await resolveDept(request, actor, wanted);
    const { state } = await readTemplatesState({ dept });

    return json({ dept, types: state.types, templates: state.templates, canEdit: canManageDept(actor, dept) });
  } catch (error) {
    console.error("GET /api/plugplay/templates", error);
    // Surface the real reason — a generic message here hides blob and
    // permission errors that only show up once deployed.
    return json({ error: `Plug library: ${error?.message || error}` }, 500);
  }
}

// Whole-library replace. Only that department's head, or an admin, can change it.
export async function PUT(request) {
  try {
    const actor = await getAuthenticatedMember(request);
    if (!actor) return json({ error: "Unauthorized." }, 401);

    const body = await request.json();
    const dept = await resolveDept(request, actor, body.dept);
    if (!canManageDept(actor, dept)) {
      return json({ error: "Only that department's head or an admin can change its plugs." }, 403);
    }

    const { state } = await writeTemplates(dept, { types: body.types, templates: body.templates });
    return json({ dept, types: state.types, templates: state.templates, canEdit: true });
  } catch (error) {
    console.error("PUT /api/plugplay/templates", error);
    return json({ error: `Saving plugs: ${error?.message || error}` }, 500);
  }
}
