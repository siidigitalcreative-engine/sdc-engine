import { NextResponse } from "next/server";
import { ImageResponse } from "next/og";
import { interFonts } from "../../../lib/print-fonts";
import { resolveWebhook } from "../../../lib/lark-target-store";
import { buildPricingImage } from "../../../lib/pricing-image";

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
    const webhook = await resolveWebhook(body.target, "tasks");

    if (!process.env.LARK_APP_ID || !process.env.LARK_APP_SECRET) {
      return NextResponse.json({ error: "Missing LARK_APP_ID / LARK_APP_SECRET (needed only to upload the image)." }, { status: 500 });
    }
    if (!webhook) {
      return NextResponse.json({ error: "No Lark destination is set. Add one on the Lark Groups page." }, { status: 500 });
    }

    const payload = body;
    const { element, width, height } = buildPricingImage(payload);
    const png = new Uint8Array(
      await new ImageResponse(element, { width, height, fonts: await interFonts() }).arrayBuffer()
    );

    const token = await getToken();
    const form = new FormData();
    form.append("image_type", "message");
    form.append("image", new Blob([png], { type: "image/png" }), "pricing.png");
    const uploadRes = await fetch(`${LARK}/open-apis/im/v1/images`, {
      method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form,
    });
    const uploadData = await uploadRes.json().catch(() => ({}));
    if (uploadData.code !== 0 || !uploadData.data?.image_key) {
      return NextResponse.json({ step: "upload", error: `Image upload failed — the app needs the "im:resource" permission (${uploadData.msg || JSON.stringify(uploadData)})` }, { status: 500 });
    }

    /* With a public link, the table goes as a rich post: the name, the
       picture, then the link, so the group can open the live list rather than
       a snapshot that ages. Without a link it stays a plain image. */
    const link = typeof body.shareUrl === "string" && /^https?:\/\//i.test(body.shareUrl) ? body.shareUrl : "";
    const title = String(body.sheet?.name || "Price list").slice(0, 120);

    const message = link
      ? {
          msg_type: "post",
          content: {
            post: {
              en_us: {
                title,
                content: [
                  [{ tag: "img", image_key: uploadData.data.image_key }],
                  [
                    { tag: "text", text: "Open the price list: " },
                    { tag: "a", text: link, href: link },
                  ],
                ],
              },
            },
          },
        }
      : { msg_type: "image", content: { image_key: uploadData.data.image_key } };

    const sendRes = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
    });
    const sendData = await sendRes.json().catch(() => ({}));
    if (!(sendData.code === 0 || sendData.StatusCode === 0)) {
      return NextResponse.json({ step: "send", error: `Custom-bot webhook rejected the image (${sendData.msg || sendData.StatusMessage || JSON.stringify(sendData)})` }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Unable to send the price list to Lark." }, { status: 500 });
  }
}
