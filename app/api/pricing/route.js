import { NextResponse } from "next/server";
import { addSheet, readPricing, removeSheet, updateSheet } from "../../lib/pricing-store";
import { viewerScope } from "../../lib/scope";
import { getAuthenticatedMember } from "../../lib/auth-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const json = (body, status = 200) => {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "private, no-cache");
  return response;
};

// Price lists belong to a department, like everything else here.
const visible = (sheets, scope) =>
  (scope.filterId ? sheets.filter((s) => (s.department || "sdc") === scope.filterId) : sheets);

export async function GET(request) {
  try {
    const actor = await getAuthenticatedMember(request);
    if (!actor) return json({ error: "Unauthorized." }, 401);

    const scope = await viewerScope(actor, request);
    const { state } = await readPricing();
    return json({
      sheets: visible(state.sheets, scope),
      scope: { departmentId: scope.departmentId, isAdmin: scope.isAdmin },
    });
  } catch (error) {
    console.error("GET /api/pricing", error);
    return json({ error: "Unable to load the price lists." }, 500);
  }
}

export async function POST(request) {
  try {
    const actor = await getAuthenticatedMember(request);
    if (!actor) return json({ error: "Unauthorized." }, 401);

    const scope = await viewerScope(actor, request);
    const body = await request.json();
    const state = await addSheet({
      ...body.sheet,
      department: scope.isAdmin ? (scope.filterId || scope.departmentId) : scope.departmentId,
      createdBy: actor.id,
    });
    return json({ sheets: visible(state.sheets, scope) }, 201);
  } catch (error) {
    return json({ error: error.message || "Unable to create that price list." }, 400);
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

    const state = await updateSheet(body.id, patch);
    return json({ sheets: visible(state.sheets, scope) });
  } catch (error) {
    return json({ error: error.message || "Unable to save that price list." }, 400);
  }
}

export async function DELETE(request) {
  try {
    const actor = await getAuthenticatedMember(request);
    if (!actor) return json({ error: "Unauthorized." }, 401);

    const scope = await viewerScope(actor, request);
    const body = await request.json();
    const state = await removeSheet(body.id);
    return json({ sheets: visible(state.sheets, scope) });
  } catch (error) {
    return json({ error: error.message || "Unable to delete that price list." }, 400);
  }
}
