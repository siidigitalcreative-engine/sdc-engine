import { NextResponse } from "next/server";
import { readStatusesState, addStatus, deleteStatus } from "../../lib/status-store";
import { mutateTasks } from "../../lib/task-store";
import { getAuthenticatedMember } from "../../lib/auth-token";

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
    const result = await readStatusesState({ ifNoneMatch: currentEtag });
    if (result.notModified) {
      return new NextResponse(null, { status: 304, headers: { ETag: result.etag, "Cache-Control": "private, no-cache" } });
    }
    return json({ statuses: result.state.statuses }, 200, result.etag);
  } catch (error) {
    console.error("GET /api/statuses", error);
    return json({ error: "Unable to load statuses." }, 500);
  }
}

export async function POST(request) {
  try {
    const actor = await getAuthenticatedMember(request);
    if (!actor) return json({ error: "Unauthorized." }, 401);
    const body = await request.json();
    const result = await addStatus(body.name);
    return json({ statuses: result.state.statuses }, 201, result.etag);
  } catch (error) {
    console.error("POST /api/statuses", error);
    return json({ error: error.message || "Unable to add status." }, 400);
  }
}

// Delete a custom status. Any task still using it is moved back to "To Do".
export async function DELETE(request) {
  try {
    const actor = await getAuthenticatedMember(request);
    if (!actor) return json({ error: "Unauthorized." }, 401);
    const body = await request.json();
    const id = String(body.id || "").trim();
    if (!id) return json({ error: "Status id is required." }, 400);

    const result = await deleteStatus(id);
    if (result.removed) {
      await mutateTasks((tasks) => tasks.map((t) => (t.status === result.removed ? { ...t, status: "todo" } : t)));
    }
    return json({ statuses: result.state.statuses }, 200, result.etag);
  } catch (error) {
    console.error("DELETE /api/statuses", error);
    return json({ error: error.message || "Unable to delete status." }, 400);
  }
}
