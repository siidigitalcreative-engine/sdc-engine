import { NextResponse } from "next/server";
import { resolveWebhook } from "../../../lib/lark-target-store";
import { getAuthenticatedMember } from "../../../lib/auth-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Posts a plain text line so a newly added webhook can be checked without
// waiting for a real export.
export async function POST(request) {
  try {
    const actor = await getAuthenticatedMember(request);
    if (!actor) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const webhook = await resolveWebhook(body.id, body.kind || "tasks");
    if (!webhook) return NextResponse.json({ error: "That destination has no webhook." }, { status: 400 });

    const res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        msg_type: "text",
        content: { text: `SDC Engine test message from ${actor.name || "the team"}. This group is set up correctly.` },
      }),
    });
    const data = await res.json().catch(() => ({}));
    const ok = data.code === 0 || data.StatusCode === 0;
    if (!ok) {
      return NextResponse.json(
        { error: `The webhook rejected the message (${data.msg || data.StatusMessage || "unknown reason"}).` },
        { status: 400 }
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/lark-targets/test", error);
    return NextResponse.json({ error: error.message || "Unable to send the test message." }, { status: 500 });
  }
}
