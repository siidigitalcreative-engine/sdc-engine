import { NextResponse } from "next/server";
import { getAuthenticatedMember } from "../../lib/auth-token";
import { readAdsWorkspace, updateAdsWorkspace } from "../../lib/ads-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  if (!await getAuthenticatedMember(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { state, missing } = await readAdsWorkspace();
    return NextResponse.json({ ...state, storageMissing: !!missing }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("GET /api/ads", error);
    return NextResponse.json({ error: "Unable to load Ads data." }, { status: 500 });
  }
}

export async function POST(request) {
  if (!await getAuthenticatedMember(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { action, payload } = await request.json();
    if (JSON.stringify(payload ?? null).length > 300000) return NextResponse.json({ error: "Payload too large." }, { status: 413 });
    const state = await updateAdsWorkspace(action, payload);
    return NextResponse.json(state, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("POST /api/ads", error);
    return NextResponse.json({ error: error.message || "Unable to save." }, { status: 400 });
  }
}
