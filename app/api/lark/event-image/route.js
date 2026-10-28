import { NextResponse } from "next/server";
import { ImageResponse } from "next/og";
import { interFonts } from "../../../lib/print-fonts";
import { resolveWebhook } from "../../../lib/lark-target-store";
import { buildEventCardImage } from "../../../lib/event-card-image";

export const runtime = "nodejs";
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
    const body = await request.json().catch(() => ({}));
    const webhook = await resolveWebhook(body.target, "calendar");

    if (!process.env.LARK_APP_ID || !process.env.LARK_APP_SECRET) {
      return NextResponse.json({ error: "Missing LARK_APP_ID / LARK_APP_SECRET (needed only to upload the image)." }, { status: 500 });
    }
    if (!webhook) {
      return NextResponse.json({ error: "No Lark destination is set. Add one on the Lark Groups page." }, { status: 500 });
    }

    const event = body.event && typeof body.event === "object" ? body.event : {};
    const { element, width, height } = buildEventCardImage(event);
    const png = new Uint8Array(
      await new ImageResponse(element, { width, height, fonts: await interFonts() }).arrayBuffer()
    );

    const token = await getToken();
    const form = new FormData();
    form.append("image_type", "message");
    form.append("image", new Blob([png], { type: "image/png" }), "calendar-event.png");
    const uploadRes = await fetch(`${LARK}/open-apis/im/v1/images`, {
      method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form,
    });
    const uploadData = await uploadRes.json().catch(() => ({}));
    if (uploadData.code !== 0 || !uploadData.data?.image_key) {
      return NextResponse.json({ step: "upload", error: `Image upload failed — the app needs the "im:resource" permission (${uploadData.msg || JSON.stringify(uploadData)})` }, { status: 500 });
    }

    const sendRes = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ msg_type: "image", content: { image_key: uploadData.data.image_key } }),
    });
    const sendData = await sendRes.json().catch(() => ({}));
    if (!(sendData.code === 0 || sendData.StatusCode === 0)) {
      return NextResponse.json({ step: "send", error: `Custom-bot webhook rejected the image (${sendData.msg || sendData.StatusMessage || JSON.stringify(sendData)})` }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Unable to send the calendar event to Lark." }, { status: 500 });
  }
}
