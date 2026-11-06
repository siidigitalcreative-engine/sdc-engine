import { ImageResponse } from "next/og";
import { interFonts } from "../../lib/print-fonts";
import { buildSubtaskImage } from "../../lib/subtask-image";

export const runtime = "nodejs";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const { element, width, height } = buildSubtaskImage(body);
  return new ImageResponse(element, { width, height, fonts: await interFonts() });
}
