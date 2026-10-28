import { NextResponse } from "next/server";
import { ImageResponse } from "next/og";
import { getAuthenticatedMember } from "../../../lib/auth-token";
import { resolveWebhook } from "../../../lib/lark-target-store";
import { interFonts } from "../../../lib/print-fonts";
import { buildAdsImage } from "../../../lib/ads-image";

export const runtime = "nodejs";
const LARK = "https://open.larksuite.com";

export async function POST(request) {
  if (!await getAuthenticatedMember(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json();
    if (JSON.stringify(body).length > 300000) return NextResponse.json({ error: "Campaign is too large to send." }, { status: 413 });
    // Reuse existing project-type destinations without modifying Lark settings.
    const webhook = await resolveWebhook(body.target, "projects");
    if (!webhook) return NextResponse.json({ error: "Select a Lark destination in the existing group picker." }, { status: 400 });
    if (!process.env.LARK_APP_ID || !process.env.LARK_APP_SECRET) return NextResponse.json({ error: "LARK_APP_ID and LARK_APP_SECRET are required for image uploads." }, { status: 500 });

    const { element, width, height } = buildAdsImage(body);
    const png = new Uint8Array(await new ImageResponse(element, { width, height, fonts: await interFonts() }).arrayBuffer());
    const tokenRes = await fetch(`${LARK}/open-apis/auth/v3/tenant_access_token/internal`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app_id: process.env.LARK_APP_ID, app_secret: process.env.LARK_APP_SECRET }),
    });
    const tokenData = await tokenRes.json().catch(() => ({}));
    if (!tokenData.tenant_access_token) throw new Error(`Lark authentication failed: ${tokenData.msg || "check app credentials"}`);

    const form = new FormData();
    form.append("image_type", "message");
    form.append("image", new Blob([png], { type: "image/png" }), "ads-campaign.png");
    const uploadRes = await fetch(`${LARK}/open-apis/im/v1/images`, {
      method: "POST", headers: { Authorization: `Bearer ${tokenData.tenant_access_token}` }, body: form,
    });
    const uploadData = await uploadRes.json().catch(() => ({}));
    if (uploadData.code !== 0 || !uploadData.data?.image_key) throw new Error(`Lark image upload failed: ${uploadData.msg || "check im:resource permission"}`);

    const sendRes = await fetch(webhook, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ msg_type: "image", content: { image_key: uploadData.data.image_key } }),
    });
    const sent = await sendRes.json().catch(() => ({}));
    if (!(sent.code === 0 || sent.StatusCode === 0)) throw new Error(`Lark webhook rejected the image: ${sent.msg || sent.StatusMessage || "unknown response"}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Unable to send campaign to Lark." }, { status: 500 });
  }
}
