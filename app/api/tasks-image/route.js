import { ImageResponse } from "next/og";
import { buildTasksImage } from "../../lib/tasks-image";

export const runtime = "edge";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const tasks = Array.isArray(body.tasks) ? body.tasks : [];
  const { element, width, height } = buildTasksImage(tasks);
  return new ImageResponse(element, { width, height });
}
