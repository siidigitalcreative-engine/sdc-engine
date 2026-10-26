import { ImageResponse } from "next/og";
import { interFonts } from "../../lib/print-fonts";
import { buildEventCardImage } from "../../lib/event-card-image";

export const runtime = "nodejs";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const event = body.event && typeof body.event === "object" ? body.event : {};
  const { element, width, height } = buildEventCardImage(event);
  return new ImageResponse(element, { width, height, fonts: await interFonts() });
}
