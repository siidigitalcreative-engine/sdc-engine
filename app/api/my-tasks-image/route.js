import { ImageResponse } from "next/og";
import { buildMyTasksImage } from "../../lib/my-tasks-image";

export const runtime = "edge";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const tasks = Array.isArray(body.tasks) ? body.tasks : [];
  const opts = body.member && typeof body.member === "object" ? body.member : {};
  const { element, width, height } = buildMyTasksImage(tasks, opts);
  return new ImageResponse(element, { width, height });
}
