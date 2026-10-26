import { ImageResponse } from "next/og";
import { buildPrintCardImage } from "../../lib/print-card-image";

export const runtime = "edge";

// Open /api/print-card-image in a browser (GET) to confirm the route is live.
export async function GET() {
  return new Response(JSON.stringify({ route: "print-card-image", renderer: "single" }), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}


// A record's image may be stored as a relative proxy path. The renderer fetches
// over the network, so make it absolute against the request's own origin.
function withAbsoluteImage(record, request) {
  if (!record || typeof record.img !== "string" || !record.img) return record;
  if (/^https?:\/\//i.test(record.img)) return record;
  try {
    return { ...record, img: new URL(record.img, new URL(request.url).origin).toString() };
  } catch {
    return { ...record, img: null };
  }
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const record = withAbsoluteImage(body.record && typeof body.record === "object" ? body.record : {}, request);
  const { element, width, height } = buildPrintCardImage(record, { layoutNote: body.layoutNote });
  return new ImageResponse(element, { width, height });
}
