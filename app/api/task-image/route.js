import { ImageResponse } from "next/og";
import { buildTaskImage } from "../../lib/task-image";

export const runtime = "edge";

// Open /api/task-image in a browser (GET) to verify this file is in the right
// folder. It MUST report renderer "single".
export async function GET() {
  return new Response(JSON.stringify({ route: "task-image", renderer: "single" }), { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const task = body.task && typeof body.task === "object" ? body.task : {};
  const { element, width, height } = buildTaskImage(task);
  return new ImageResponse(element, { width, height });
}
