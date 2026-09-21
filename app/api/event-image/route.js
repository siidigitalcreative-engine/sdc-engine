import { ImageResponse } from "next/og";
import { buildEventCardImage } from "../../lib/event-card-image";

export const runtime = "edge";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const event = body.event && typeof body.event === "object" ? body.event : {};
  const { element, width, height } = buildEventCardImage(event);
  return new ImageResponse(element, { width, height });
}
