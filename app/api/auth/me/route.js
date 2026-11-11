import { NextResponse } from "next/server";
import { clearAuthCookie, getAuthenticatedMember } from "../../../lib/auth-token";
import { sanitizeMember } from "../../../lib/member-store";
import { PAGES, departmentCanOpen, departmentForMember, memberIsAdmin } from "../../../lib/department-store";

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
    return response;
  } catch (error) {
    console.error("GET /api/auth/me", error);
    return NextResponse.json({ member: null, error: "Unable to verify sign in." }, { status: 500 });
  }
}
