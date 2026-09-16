import { ImageResponse } from "next/og";
import { buildTasksImage } from "../../lib/tasks-image";

export const runtime = "edge";

// Open /api/tasks-image in a browser (GET) to verify this file is in the right
// folder. It MUST report renderer "board". If it says "single", this route has
// the single-task file's contents — the two were swapped.
export async function GET() {
  return new Response(JSON.stringify({ route: "tasks-image", renderer: "board" }), { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const tasks = Array.isArray(body.tasks) ? body.tasks : [];
  const statuses = Array.isArray(body.statuses) ? body.statuses : null;
  const { element, width, height } = buildTasksImage(tasks, statuses);
  return new ImageResponse(element, { width, height });
}
