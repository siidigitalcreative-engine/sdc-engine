import { NextResponse } from "next/server";
import { readProjectsState, mutateProjects, cleanProjectName } from "../../lib/project-store";
import { getAuthenticatedMember } from "../../lib/auth-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body, status = 200, etag) {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "private, no-cache");
  if (etag) response.headers.set("ETag", etag);
  return response;
}

export async function GET(request) {
  try {
    const currentEtag = request.headers.get("if-none-match") || undefined;
    const result = await readProjectsState({ ifNoneMatch: currentEtag });
    if (result.notModified) {
      return new NextResponse(null, { status: 304, headers: { ETag: result.etag, "Cache-Control": "private, no-cache" } });
    }
    return json({ projects: result.state.projects }, 200, result.etag);
  } catch (error) {
    console.error("GET /api/projects", error);
    return json({ error: "Unable to load projects." }, 500);
  }
}

export async function POST(request) {
  try {
    const actor = await getAuthenticatedMember(request);
    if (!actor) return json({ error: "Unauthorized." }, 401);
    const body = await request.json();
    const name = cleanProjectName(body.name);
    const result = await mutateProjects((projects) => [...projects, name]);
    return json({ projects: result.state.projects }, 201, result.etag);
  } catch (error) {
    console.error("POST /api/projects", error);
    return json({ error: error.message || "Unable to add project." }, 400);
  }
}

export async function DELETE(request) {
  try {
    const actor = await getAuthenticatedMember(request);
    if (!actor) return json({ error: "Unauthorized." }, 401);
    const body = await request.json();
    const name = String(body.name || "").trim();
    if (!name) return json({ error: "Project name is required." }, 400);
    const result = await mutateProjects((projects) => projects.filter((p) => p.toLowerCase() !== name.toLowerCase()));
    return json({ projects: result.state.projects }, 200, result.etag);
  } catch (error) {
    console.error("DELETE /api/projects", error);
    return json({ error: error.message || "Unable to delete project." }, 400);
  }
}
