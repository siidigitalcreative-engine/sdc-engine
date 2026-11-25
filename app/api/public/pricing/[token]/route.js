import { NextResponse } from "next/server";
import { getSharedSheet } from "../../../../lib/pricing-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Open to anyone holding the link; the token is the whole credential.
export async function GET(request, { params }) {
  try {
    const sheet = await getSharedSheet(params?.token);
    if (!sheet) return NextResponse.json({ error: "That link is not available." }, { status: 404 });

    const response = NextResponse.json({ sheet });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    console.error("GET /api/public/pricing/[token]", error);
    return NextResponse.json({ error: "Unable to load that price list." }, { status: 500 });
  }
}
