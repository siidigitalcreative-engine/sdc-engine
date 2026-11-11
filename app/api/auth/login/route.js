import { NextResponse } from "next/server";
import { createAuthToken, setAuthCookie } from "../../../lib/auth-token";
import { readMembersState, sanitizeMember, verifyPin } from "../../../lib/member-store";
import { PAGES, departmentCanOpen, departmentForMember, memberIsAdmin } from "../../../lib/department-store";

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

    // Return the exact server-authorized access state with the login result.
    // This prevents the sidebar from briefly using stale/null permissions.
    const department = await departmentForMember(member);
    const isAdmin = memberIsAdmin(member, department);
    const allowedPages = PAGES.filter((page) => departmentCanOpen(department, page.id, isAdmin)).map((page) => page.id);
    const response = NextResponse.json({
      member: sanitizeMember(member),
      department: department ? { id: department.id, name: department.name, color: department.color, admin: department.admin } : null,
      accessLevel: String(member.accessLevel || "").trim() || (department?.admin ? "admin" : "member"),
      allowedPages,
    });
    response.headers.set("Cache-Control", "no-store");
    setAuthCookie(response, createAuthToken(member));
    return response;
  } catch (error) {
    console.error("POST /api/auth/login", error);
    return NextResponse.json({ error: "Unable to sign in." }, { status: 500 });
  }
}
