import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Bump this string whenever you ship. Hit /api/version in the browser to
// confirm the running deployment is the build you expect.
export async function GET() {
  return NextResponse.json(
    { version: "2026-10-23-print-speed-thumb", ok: true },
    { headers: { "Cache-Control": "no-store" } }
  );
}
