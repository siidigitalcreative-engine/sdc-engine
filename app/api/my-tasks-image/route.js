import { ImageResponse } from "next/og";
import { interFonts } from "../../lib/print-fonts";
import { buildMyTasksImage } from "../../lib/my-tasks-image";

export const runtime = "nodejs";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const tasks = Array.isArray(body.tasks) ? body.tasks : [];
  const opts = body.member && typeof body.member === "object" ? body.member : {};
  const { element, width, height } = buildMyTasksImage(tasks, opts);
  return new ImageResponse(element, { width, height, fonts: await interFonts() });
}
