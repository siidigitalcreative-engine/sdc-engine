import { NextResponse } from "next/server";
import { clearAuthCookie, getAuthenticatedMember } from "../../../lib/auth-token";
import { sanitizeMember } from "../../../lib/member-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const member = await getAuthenticatedMember(request);
    if (!member) {
      const response = NextResponse.json({ member: null }, { status: 401 });
      response.headers.set("Cache-Control", "no-store");
      clearAuthCookie(response);
      return response;
    }

    const response = NextResponse.json({ member: sanitizeMember(member) });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    console.error("GET /api/auth/me", error);
    return NextResponse.json({ member: null, error: "Unable to verify sign in." }, { status: 500 });
  }
}
