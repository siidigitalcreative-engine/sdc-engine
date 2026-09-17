import { get } from "@vercel/blob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Serves a private attachment blob over a stable public URL so Lark, Base, and
// anyone with the link can open it. The blob itself stays private; this route
// reads it server-side with the store token and streams it back.
export async function GET(request, { params }) {
  try {
    const parts = Array.isArray(params?.path) ? params.path : [];
    const pathname = parts.map((p) => decodeURIComponent(p)).join("/");
    if (!pathname) return new Response("Not found", { status: 404 });

    const result = await get(pathname, { access: "private", useCache: false });
    if (!result || result.statusCode !== 200 || !result.stream) {
      return new Response("Not found", { status: 404 });
    }

    return new Response(result.stream, {
      headers: {
        "Content-Type": result.blob?.contentType || "application/octet-stream",
        "Content-Disposition": "inline",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("GET /api/attachments", error);
    return new Response("Error", { status: 500 });
  }
}
