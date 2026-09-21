// Place this file at:  app/api/lark/events/route.js
//
// The "reception desk" for the SDC Assistant bot. Lark POSTs here when you
// message the bot; this reads your Base (via the existing lark-base helper)
// and replies in the chat. Reuses all your existing LARK_* env vars.
//
// NEW env var needed (add in Vercel):
//   LARK_VERIFICATION_TOKEN  = Verification Token from the Encryption Strategy tab
// Optional:
//   LARK_BOT_TRIGGER         = the word that triggers a task lookup (default "tasks")

import { NextResponse } from "next/server";
import { listTasks, sendReply } from "../../../lib/lark-base";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const clean = (v) => String(v || "").trim();
const VERIFICATION_TOKEN = clean(process.env.LARK_VERIFICATION_TOKEN);
const TRIGGER_WORD = (clean(process.env.LARK_BOT_TRIGGER) || "tasks").toLowerCase();

function formatTasks(tasks) {
  if (!tasks.length) return "No tasks found.";
  return tasks
    .map((t, i) => {
      const bits = [t.title || "Untitled"];
      if (t.status) bits.push(`[${t.status}]`);
      if (t.assignees) bits.push(`— ${t.assignees}`);
      if (t.date) bits.push(`(due ${t.date})`);
      return `${i + 1}. ${bits.join(" ")}`;
    })
    .join("\n");
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));

  // 1. One-time handshake when you save the Request URL in the console.
  if (body.type === "url_verification") {
    return NextResponse.json({ challenge: body.challenge });
  }

  // 2. Confirm the request is really from Lark.
  const token = body?.header?.token ?? body?.token;
  if (VERIFICATION_TOKEN && token !== VERIFICATION_TOKEN) {
    return NextResponse.json({ code: -1, msg: "invalid token" }, { status: 401 });
  }

  // 3. Handle an incoming message.
  try {
    if (body?.header?.event_type === "im.message.receive_v1") {
      const message = body?.event?.message;
      if (message?.message_type === "text") {
        const raw = JSON.parse(message.content || "{}").text || "";
        const text = raw
          .split(" ")
          .filter((w) => !w.startsWith("@_")) // drop @mention placeholders
          .join(" ")
          .trim()
          .toLowerCase();

        if (text.includes(TRIGGER_WORD)) {
          await sendReply(message.message_id, formatTasks(await listTasks(15)));
        } else {
          await sendReply(
            message.message_id,
            `Hi! Type "${TRIGGER_WORD}" and I'll show your tasks.`
          );
        }
      }
    }
  } catch (e) {
    // Log but still return 200 so Lark doesn't spam retries.
    console.error("lark events error:", e);
  }

  return NextResponse.json({ code: 0 });
}
