import { ImageResponse } from "next/og";
import { interFonts } from "../../lib/print-fonts";
import { buildTimeBlockImage } from "../../lib/time-block-image";

export const runtime = "nodejs";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const { element, width, height } = buildTimeBlockImage(body);
  return new ImageResponse(element, { width, height, fonts: await interFonts() });
}
