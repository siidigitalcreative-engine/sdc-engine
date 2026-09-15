import { NextResponse } from "next/server";
import { clearAuthCookie } from "../../../lib/auth-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.headers.set("Cache-Control", "no-store");
  clearAuthCookie(response);
  return response;
}
