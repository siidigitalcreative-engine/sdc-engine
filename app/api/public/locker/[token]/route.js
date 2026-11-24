import { NextResponse } from "next/server";
import { getSharedLocker } from "../../../../lib/locker-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Open to anyone holding the link; the token is the whole credential.
export async function GET(request, { params }) {
  try {
    const locker = await getSharedLocker(params?.token);
    if (!locker) return NextResponse.json({ error: "That link is not available." }, { status: 404 });

    const response = NextResponse.json({ locker });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    console.error("GET /api/public/locker/[token]", error);
    return NextResponse.json({ error: "Unable to load that locker." }, { status: 500 });
  }
}
