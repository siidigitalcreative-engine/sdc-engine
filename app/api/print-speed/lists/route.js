import { NextResponse } from "next/server";
import { addOption, renameOption, removeOption } from "../../../lib/print-speed-store";
import { getAuthenticatedMember } from "../../../lib/auth-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body, status = 200, etag) {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "private, no-cache");
  if (etag) response.headers.set("ETag", etag);
  return response;
}

const payload = (result) => ({ records: result.state.records, lists: result.state.lists });

// Add an option to one of the dropdown lists.
export async function POST(request) {
  try {
    const actor = await getAuthenticatedMember(request);
    if (!actor) return json({ error: "Unauthorized." }, 401);
    const body = await request.json();
    const result = await addOption(body.list, body.name, body.mode);
    return json(payload(result), 201, result.etag);
  } catch (error) {
    console.error("POST /api/print-speed/lists", error);
    return json({ error: error.message || "Unable to add that option." }, 400);
  }
}

// Rename an option; every record using it follows the new name.
export async function PATCH(request) {
  try {
    const actor = await getAuthenticatedMember(request);
    if (!actor) return json({ error: "Unauthorized." }, 401);
    const body = await request.json();
    const result = await renameOption(body.list, body.name, body.newName);
    return json(payload(result), 200, result.etag);
  } catch (error) {
    console.error("PATCH /api/print-speed/lists", error);
    return json({ error: error.message || "Unable to rename that option." }, 400);
  }
}

// Remove an option. Refused while any record still uses it.
export async function DELETE(request) {
  try {
    const actor = await getAuthenticatedMember(request);
    if (!actor) return json({ error: "Unauthorized." }, 401);
    const body = await request.json();
    const result = await removeOption(body.list, body.name);
    return json(payload(result), 200, result.etag);
  } catch (error) {
    console.error("DELETE /api/print-speed/lists", error);
    return json({ error: error.message || "Unable to remove that option." }, 400);
  }
}
