import { ImageResponse } from "next/og";
import { buildPrintOverviewImage } from "../../lib/print-overview-image";

export const runtime = "edge";


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
  const records = (Array.isArray(body.records) ? body.records : []).map((r) => withAbsoluteImage(r, request));
  const { element, width, height } = buildPrintOverviewImage(records, {
    title: body.title, subtitle: body.subtitle, notes: body.notes,
  });
  return new ImageResponse(element, { width, height });
}
