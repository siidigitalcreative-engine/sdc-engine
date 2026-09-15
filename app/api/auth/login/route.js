import { NextResponse } from "next/server";
import { createAuthToken, setAuthCookie } from "../../../lib/auth-token";
import { readMembersState, sanitizeMember, verifyPin } from "../../../lib/member-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const { memberId, pin } = await request.json();
    const { state } = await readMembersState();
    const member = state.members.find((item) => item.id === String(memberId || ""));

    if (!member || !verifyPin(pin, member.pinHash)) {
      return NextResponse.json({ error: "Incorrect member or PIN." }, { status: 401 });
    }

    const response = NextResponse.json({ member: sanitizeMember(member) });
    response.headers.set("Cache-Control", "no-store");
    setAuthCookie(response, createAuthToken(member));
    return response;
  } catch (error) {
    console.error("POST /api/auth/login", error);
    return NextResponse.json({ error: "Unable to sign in." }, { status: 500 });
  }
}
