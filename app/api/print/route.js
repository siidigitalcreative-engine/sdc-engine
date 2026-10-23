import { NextResponse } from "next/server";
import {
  readPrintSpeedState, createRecord, updateRecord, deleteRecord,
} from "../../lib/print-store";
import { getAuthenticatedMember } from "../../lib/auth-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body, status = 200, etag) {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "private, no-cache");
  if (etag) response.headers.set("ETag", etag);
  return response;
}

const payload = (result) => ({ records: result.state.records, lists: result.state.lists });

export async function GET(request) {
  try {
    const currentEtag = request.headers.get("if-none-match") || undefined;
    const result = await readPrintSpeedState({ ifNoneMatch: currentEtag });
    if (result.notModified) {
      return new NextResponse(null, {
        status: 304,
        headers: { ETag: result.etag, "Cache-Control": "private, no-cache" },
      });
    }
    return json(payload(result), 200, result.etag);
  } catch (error) {
    console.error("GET /api/print", error);
    return json({ error: "Unable to load print speed records." }, 500);
  }
}

export async function POST(request) {
  try {
    const actor = await getAuthenticatedMember(request);
    if (!actor) return json({ error: "Unauthorized." }, 401);
    const body = await request.json();
    const result = await createRecord(body.data || {});
    return json(payload(result), 201, result.etag);
  } catch (error) {
    console.error("POST /api/print", error);
    return json({ error: error.message || "Unable to add the record." }, 400);
  }
}

export async function PATCH(request) {
  try {
    const actor = await getAuthenticatedMember(request);
    if (!actor) return json({ error: "Unauthorized." }, 401);
    const body = await request.json();
    const result = await updateRecord(body.id, body.data || {});
    return json(payload(result), 200, result.etag);
  } catch (error) {
    console.error("PATCH /api/print", error);
    return json({ error: error.message || "Unable to save the record." }, 400);
  }
}

export async function DELETE(request) {
  try {
    const actor = await getAuthenticatedMember(request);
    if (!actor) return json({ error: "Unauthorized." }, 401);
    const body = await request.json();
    const result = await deleteRecord(body.id);
    return json(payload(result), 200, result.etag);
  } catch (error) {
    console.error("DELETE /api/print", error);
    return json({ error: error.message || "Unable to delete the record." }, 400);
  }
}
