import { ImageResponse } from "next/og";
import { buildCalendarElement, IMG_W, IMG_H } from "../../lib/calendar-image";

export const runtime = "edge";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const events = Array.isArray(body.events) ? body.events : [];
  return new ImageResponse(buildCalendarElement(events, { month: body.month }), { width: IMG_W, height: IMG_H });
}
