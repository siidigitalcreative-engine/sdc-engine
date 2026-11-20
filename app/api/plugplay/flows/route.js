import { NextResponse } from "next/server";
import { getAuthenticatedMember } from "../../../lib/auth-token";
import { activeDept, canDeleteRecord, canManageDept } from "../../../lib/access";
import { appendEvent, createFlow, mutateFlows, readFlowsState, reseedItems, updateFlow } from "../../../lib/flow-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body, status = 200, etag) {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate");
  if (etag) response.headers.set("ETag", etag);
  return response;
}

export async function GET(request) {
  try {
    const actor = await getAuthenticatedMember(request);
    if (!actor) return json({ error: "Unauthorized." }, 401);

    const dept = await activeDept(request, actor);
    const result = await readFlowsState({ dept, ifNoneMatch: request.headers.get("if-none-match") || undefined });

    if (result.notModified) {
      return new NextResponse(null, {
        status: 304,
        headers: { ETag: result.etag, "Cache-Control": "private, no-cache, no-store, must-revalidate" },
      });
    }

    return json({ flows: result.state.flows, dept, canManage: canManageDept(actor, dept) }, 200, result.etag);
  } catch (error) {
    console.error("GET /api/plugplay/flows", error);
    return json({ error: `Playbooks: ${error?.message || error}` }, 500);
  }
}

// New playbook — empty, or a copy of an existing one (`from`).
export async function POST(request) {
  try {
    const actor = await getAuthenticatedMember(request);
    if (!actor) return json({ error: "Unauthorized." }, 401);

    const dept = await activeDept(request, actor);
    const body = await request.json();

    let items = Array.isArray(body.items) ? body.items : [];
    if (body.from) {
      const { state } = await readFlowsState({ dept });
      const source = state.flows.find((flow) => flow.id === String(body.from));
      if (!source) return json({ error: "Playbook not found." }, 404);
      items = source.items;
    }

    let flow = createFlow({
      name: body.name,
      desc: body.desc,
      depts: body.depts,
      items: reseedItems(items),
      createdBy: actor.id,
    });
    flow = appendEvent(flow, { verb: "created the playbook", kind: "run" }, actor.id);

    const result = await mutateFlows(dept, (flows) => [...flows, flow]);
    return json({ flows: result.state.flows, flow }, 201, result.etag);
  } catch (error) {
    console.error("POST /api/plugplay/flows", error);
    return json({ error: `Creating a playbook: ${error?.message || error}` }, 500);
  }
}

// Every change comes through here, with an optional log entry describing it.
export async function PATCH(request) {
  try {
    const actor = await getAuthenticatedMember(request);
    if (!actor) return json({ error: "Unauthorized." }, 401);

    const dept = await activeDept(request, actor);
    const body = await request.json();
    const flowId = String(body.id || "");
    if (!flowId) return json({ error: "Playbook ID is required." }, 400);

    const { createdBy: _ignored, history: _h, ...changes } = body.data || {};

    let updated = null;
    const result = await mutateFlows(dept, (flows) => {
      const index = flows.findIndex((flow) => flow.id === flowId);
      if (index < 0) throw new Error("Playbook not found.");
      updated = updateFlow(flows[index], changes);
      if (body.event) updated = appendEvent(updated, body.event, actor.id);
      const next = [...flows];
      next[index] = updated;
      return next;
    });

    return json({ flows: result.state.flows, flow: updated }, 200, result.etag);
  } catch (error) {
    console.error("PATCH /api/plugplay/flows", error);
    return json({ error: `Saving the playbook: ${error?.message || error}` }, 500);
  }
}

// Permanent removal, and only from Trash — moving to Trash is a PATCH.
export async function DELETE(request) {
  try {
    const actor = await getAuthenticatedMember(request);
    if (!actor) return json({ error: "Unauthorized." }, 401);

    const dept = await activeDept(request, actor);
    const body = await request.json();
    const flowId = String(body.id || "");
    if (!flowId) return json({ error: "Playbook ID is required." }, 400);

    const { state } = await readFlowsState({ dept });
    const target = state.flows.find((flow) => flow.id === flowId);
    if (!target) return json({ error: "Playbook not found." }, 404);
    if (!target.deleted) return json({ error: "Move the playbook to Trash before deleting it for good." }, 400);
    if (!canDeleteRecord(actor, dept, target)) {
      return json({ error: "Only the person who created this playbook, the department head or an admin can delete it." }, 403);
    }

    const result = await mutateFlows(dept, (flows) => flows.filter((flow) => flow.id !== flowId));
    return json({ flows: result.state.flows }, 200, result.etag);
  } catch (error) {
    console.error("DELETE /api/plugplay/flows", error);
    return json({ error: `Deleting the playbook: ${error?.message || error}` }, 500);
  }
}
