import { NextResponse } from "next/server";
import { baseProbe } from "../../../lib/lark-base";
import { getAuthenticatedMember } from "../../../lib/auth-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const actor = await getAuthenticatedMember(request);
  if (!actor) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const result = await baseProbe();
  return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
}
