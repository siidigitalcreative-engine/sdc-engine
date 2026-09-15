import { NextResponse } from "next/server";
import { ImageResponse } from "next/og";
import { buildCalendarImage } from "../../../lib/calendar-image";

export const runtime = "edge";
const LARK = "https://open.larksuite.com";

async function getToken() {
  const res = await fetch(`${LARK}/open-apis/auth/v3/tenant_access_token/internal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app_id: process.env.LARK_APP_ID, app_secret: process.env.LARK_APP_SECRET }),
  });
  const data = await res.json().catch(() => ({}));
  if (!data.tenant_access_token) {
    throw new Error(`Could not get a Lark token — check LARK_APP_ID / LARK_APP_SECRET (${data.msg || JSON.stringify(data)})`);
  }
  return data.tenant_access_token;
}

export async function POST(request) {
  try {
    if (!process.env.LARK_APP_ID || !process.env.LARK_APP_SECRET) {
      return NextResponse.json({ error: "Missing LARK_APP_ID / LARK_APP_SECRET (needed only to upload the image)." }, { status: 500 });
    }
    if (!process.env.LARK_CALENDAR_BOT_WEBHOOK) {
      return NextResponse.json({ error: "Missing LARK_CALENDAR_BOT_WEBHOOK (the custom bot that posts to the group)." }, { status: 500 });
    }

    const body = await request.json().catch(() => ({}));
    const events = Array.isArray(body.events) ? body.events : [];

    // 1) render the calendar to PNG bytes
    const { element, width, height } = buildCalendarImage(events, { month: body.month });
    const image = new ImageResponse(element, { width, height });
    const png = new Uint8Array(await image.arrayBuffer());

    // 2) upload via the app -> image_key  (app-level; does NOT require the bot to be in any chat)
    const token = await getToken();
    const form = new FormData();
    form.append("image_type", "message");
    form.append("image", new Blob([png], { type: "image/png" }), "calendar.png");
    const uploadRes = await fetch(`${LARK}/open-apis/im/v1/images`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    const uploadData = await uploadRes.json().catch(() => ({}));
    if (uploadData.code !== 0 || !uploadData.data?.image_key) {
      return NextResponse.json({ step: "upload", error: `Image upload failed — the app needs the "im:resource" permission (${uploadData.msg || JSON.stringify(uploadData)})` }, { status: 500 });
    }

    // 3) deliver THROUGH the custom bot webhook (already a member of the group)
    const sendRes = await fetch(process.env.LARK_CALENDAR_BOT_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ msg_type: "image", content: { image_key: uploadData.data.image_key } }),
    });
    const sendData = await sendRes.json().catch(() => ({}));
    const ok = sendData.code === 0 || sendData.StatusCode === 0;
    if (!ok) {
      return NextResponse.json({ step: "send", error: `Custom-bot webhook rejected the image (${sendData.msg || sendData.StatusMessage || JSON.stringify(sendData)})` }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Unable to send calendar image to Lark." }, { status: 500 });
  }
}
