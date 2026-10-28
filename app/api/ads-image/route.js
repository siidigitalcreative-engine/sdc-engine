import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";
import { getAuthenticatedMember } from "../../lib/auth-token";
import { interFonts } from "../../lib/print-fonts";
import { buildAdsImage } from "../../lib/ads-image";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  if (!await getAuthenticatedMember(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const payload = await request.json();
    if (JSON.stringify(payload).length > 300000) return NextResponse.json({ error: "Campaign is too large to export." }, { status: 413 });
    const { element, width, height } = buildAdsImage(payload);
    return new ImageResponse(element, { width, height, fonts: await interFonts() });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Unable to export campaign image." }, { status: 500 });
  }
}
