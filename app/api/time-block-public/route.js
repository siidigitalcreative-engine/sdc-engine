import { NextResponse } from "next/server";
import { getAuthenticatedMember } from "../../lib/auth-token";
import { getPublicSettings, setPublicSettings } from "../../lib/time-block-public";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const reply = (data, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });

export async function GET(request) {
  try {
    const member = await getAuthenticatedMember(request);
    if (!member) return reply({ error: "Unauthorized." }, 401);
    return reply(await getPublicSettings(member));
  } catch (error) { console.error("Public link settings GET", error); return reply({ error: "Unable to load public link settings." }, 500); }
}

export async function POST(request) {
  try {
    const member = await getAuthenticatedMember(request);
    if (!member) return reply({ error: "Unauthorized." }, 401);
    const body = await request.json();
    if (!body || typeof body !== "object" || (body.enabled !== undefined && typeof body.enabled !== "boolean") || (body.view !== undefined && typeof body.view !== "string")) return reply({ error: "Invalid settings." }, 400);
    return reply(await setPublicSettings(member, { enabled: body.enabled, view: body.view }));
  } catch (error) { console.error("Public link settings POST", error); return reply({ error: error.message || "Unable to save public link settings." }, 400); }
}
