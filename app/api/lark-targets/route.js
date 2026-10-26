import { NextResponse } from "next/server";
import { addTarget, listTargets, removeTarget, updateTarget } from "../../lib/lark-target-store";
import { getAuthenticatedMember } from "../../lib/auth-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (body, status = 200) => {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "private, no-cache");
  return response;
};

// Webhook URLs are never returned, only a short hint, so the list can be shown
// on screen without exposing the secret part of anyone's bot URL.
export async function GET(request) {
  try {
    const actor = await getAuthenticatedMember(request);
    if (!actor) return json({ error: "Unauthorized." }, 401);
    const kind = new URL(request.url).searchParams.get("kind") || "tasks";
    return json({ targets: await listTargets(kind) });
  } catch (error) {
    console.error("GET /api/lark-targets", error);
    return json({ error: "Unable to load the Lark destinations." }, 500);
  }
}

export async function POST(request) {
  try {
    const actor = await getAuthenticatedMember(request);
    if (!actor) return json({ error: "Unauthorized." }, 401);
    const body = await request.json();
    await addTarget(body.name, body.webhook);
    return json({ targets: await listTargets(body.kind || "tasks") }, 201);
  } catch (error) {
    console.error("POST /api/lark-targets", error);
    return json({ error: error.message || "Unable to add that destination." }, 400);
  }
}

export async function PATCH(request) {
  try {
    const actor = await getAuthenticatedMember(request);
    if (!actor) return json({ error: "Unauthorized." }, 401);
    const body = await request.json();
    await updateTarget(body.id, { name: body.name, webhook: body.webhook });
    return json({ targets: await listTargets(body.kind || "tasks") });
  } catch (error) {
    console.error("PATCH /api/lark-targets", error);
    return json({ error: error.message || "Unable to save that destination." }, 400);
  }
}

export async function DELETE(request) {
  try {
    const actor = await getAuthenticatedMember(request);
    if (!actor) return json({ error: "Unauthorized." }, 401);
    const body = await request.json();
    await removeTarget(body.id);
    return json({ targets: await listTargets(body.kind || "tasks") });
  } catch (error) {
    console.error("DELETE /api/lark-targets", error);
    return json({ error: error.message || "Unable to remove that destination." }, 400);
  }
}
