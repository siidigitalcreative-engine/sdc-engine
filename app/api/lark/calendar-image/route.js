import { NextResponse } from "next/server";
import { ImageResponse } from "next/og";
import { buildCalendarElement, IMG_W, IMG_H } from "../../../lib/calendar-image";

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
      return NextResponse.json({ error: "Missing LARK_APP_ID or LARK_APP_SECRET." }, { status: 500 });
    }
    if (!process.env.LARK_CHAT_ID) {
      return NextResponse.json({ error: "Missing LARK_CHAT_ID." }, { status: 500 });
    }

    const body = await request.json().catch(() => ({}));
    const events = Array.isArray(body.events) ? body.events : [];

    const image = new ImageResponse(buildCalendarElement(events, { month: body.month }), { width: IMG_W, height: IMG_H });
    const png = new Uint8Array(await image.arrayBuffer());

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
      return NextResponse.json({ step: "upload", error: `Image upload failed — the app likely needs the "im:resource" permission (${uploadData.msg || JSON.stringify(uploadData)})` }, { status: 500 });
    }

    const sendRes = await fetch(`${LARK}/open-apis/im/v1/messages?receive_id_type=chat_id`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        receive_id: process.env.LARK_CHAT_ID,
        msg_type: "image",
        content: JSON.stringify({ image_key: uploadData.data.image_key }),
      }),
    });
    const sendData = await sendRes.json().catch(() => ({}));
    if (sendData.code !== 0) {
      return NextResponse.json({ step: "send", error: `Send failed — make sure the app is in that chat and has "im:message" (${sendData.msg || JSON.stringify(sendData)})` }, { status: 500 });
    }

    return NextResponse.json({ success: true, message_id: sendData.data?.message_id });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Unable to send calendar image to Lark." }, { status: 500 });
  }
}
