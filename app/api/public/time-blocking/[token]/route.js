import { NextResponse } from "next/server";
import { getPublicTimeline } from "../../../../lib/time-block-public";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  try {
    const date = new URL(request.url).searchParams.get("date");
    const timeline = await getPublicTimeline(params.token, date);
    if (!timeline) return NextResponse.json({ error: "This public timeline is unavailable." }, { status: 404, headers: { "Cache-Control": "no-store" } });
    return NextResponse.json(timeline, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Public timeline GET", error);
    return NextResponse.json({ error: "Unable to load the public timeline." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
