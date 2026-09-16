import { ImageResponse } from "next/og";
import { buildTaskImage } from "../../lib/task-image";

export const runtime = "edge";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const task = body.task && typeof body.task === "object" ? body.task : {};
  const { element, width, height } = buildTaskImage(task);
  return new ImageResponse(element, { width, height });
}
