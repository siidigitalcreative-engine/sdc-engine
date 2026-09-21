import { get } from "@vercel/blob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Serves a private attachment blob over a stable public URL so Lark, Base, and
// anyone with the link can open it. The blob itself stays private; this route
// reads it server-side with the store token and streams it back.
//
// Video players (including Lark's in-app player) require Range-request
// support to play a video at all, not only to seek — they probe for
// Accept-Ranges/206 support before starting playback. So the incoming Range
// header is forwarded to the Blob origin fetch, and a real 206 Partial
// Content response is relayed back when the origin returns one.
export async function GET(request, { params }) {
  try {
    const parts = Array.isArray(params?.path) ? params.path : [];
    const pathname = parts.map((p) => decodeURIComponent(p)).join("/");
    if (!pathname) return new Response("Not found", { status: 404 });

    const range = request.headers.get("range") || undefined;
    const result = await get(pathname, {
      access: "private",
      useCache: false,
      headers: range ? { Range: range } : undefined,
    });
    if (!result || result.statusCode !== 200 || !result.stream) {
      return new Response("Not found", { status: 404 });
    }

    const origin = result.headers;
    const contentRange = origin.get("content-range");
    const contentLength = origin.get("content-length");
    const isPartial = !!contentRange;

    const headers = {
      "Content-Type": result.blob?.contentType || "application/octet-stream",
      "Content-Disposition": "inline",
      "Cache-Control": "public, max-age=31536000, immutable",
      "Accept-Ranges": origin.get("accept-ranges") || "bytes",
    };
    if (contentLength) headers["Content-Length"] = contentLength;
    if (contentRange) headers["Content-Range"] = contentRange;

    return new Response(result.stream, { status: isPartial ? 206 : 200, headers });
  } catch (error) {
    console.error("GET /api/attachments", error);
    return new Response("Error", { status: 500 });
  }
}
