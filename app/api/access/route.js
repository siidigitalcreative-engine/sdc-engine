import { NextResponse } from "next/server";
import { PAGES, departmentCanOpen, departmentForMember } from "../../lib/department-store";
import { getAuthenticatedMember } from "../../lib/auth-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The authority on whether the signed-in member may open a page.
export async function GET(request) {
  const page = new URL(request.url).searchParams.get("page") || "";
  try {
    const member = await getAuthenticatedMember(request);
    if (!member) return NextResponse.json({ allowed: false, reason: "signed-out" }, { status: 401 });

    const department = await departmentForMember(member);
    const allowed = departmentCanOpen(department, page);
    const response = NextResponse.json({
      allowed,
      page,
      department: department ? { id: department.id, name: department.name, admin: department.admin } : null,
      allowedPages: PAGES.filter((p) => departmentCanOpen(department, p.id)).map((p) => p.id),
    });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    console.error("GET /api/access", error);
    return NextResponse.json({ allowed: false, error: "Unable to check access." }, { status: 500 });
  }
}
