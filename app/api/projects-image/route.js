import { ImageResponse } from "next/og";
import { buildProjectsImage } from "../../lib/projects-image";

export const runtime = "edge";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const projects = Array.isArray(body.projects) ? body.projects : [];
  const { element, width, height } = buildProjectsImage(projects);
  return new ImageResponse(element, { width, height });
}
