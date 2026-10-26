import { ImageResponse } from "next/og";
import { interFonts } from "../../lib/print-fonts";
import { buildCalendarImage } from "../../lib/calendar-image";

export const runtime = "nodejs";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const events = Array.isArray(body.events) ? body.events : [];
  const { element, width, height } = buildCalendarImage(events, { month: body.month });
  return new ImageResponse(element, { width, height, fonts: await interFonts() });
}
