import { NextResponse } from "next/server";
import { readAppSettings, updateAppSettings } from "../../lib/app-settings-store";
import { departmentForMember } from "../../lib/department-store";
import { getAuthenticatedMember } from "../../lib/auth-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (body, status = 200) => {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
};

// Readable by anyone, because the sign-in screen shows the name before login.
export async function GET() {
  try {
    const { settings } = await readAppSettings();
    return json({ settings });
  } catch (error) {
    console.error("GET /api/app-settings", error);
    return json({ error: "Unable to load the workspace settings." }, 500);
  }
}

export async function PATCH(request) {
  try {
    const member = await getAuthenticatedMember(request);
    if (!member) return json({ error: "Unauthorized." }, 401);

    const department = await departmentForMember(member);
    const level = String(member.accessLevel || "").trim() || (department?.admin ? "admin" : "member");
    if (level !== "admin" && !department?.admin) {
      return json({ error: "Only Management, Admin or HOD Admin can rename the workspace." }, 403);
    }

    const body = await request.json();
    const settings = await updateAppSettings({
      name: body.name,
      tagline: body.tagline,
      signInTitle: body.signInTitle,
      signInSubtitle: body.signInSubtitle,
    });
    return json({ settings });
  } catch (error) {
    return json({ error: error.message || "Unable to save the workspace settings." }, 400);
  }
}
