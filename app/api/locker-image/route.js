import { ImageResponse } from "next/og";
import { interFonts } from "../../lib/print-fonts";
import { buildLockerImage } from "../../lib/locker-image";

export const runtime = "nodejs";

/* The renderer fetches each picture over the network, so a stored path has to
   be absolute against this request's own origin. */
const absolute = (payload, request) => {
  const origin = new URL(request.url).origin;
  const items = (payload.locker?.items || []).map((item) => {
    if (!item?.url || /^https?:\/\//i.test(item.url)) return item;
    try {
      return { ...item, url: new URL(item.url, origin).toString() };
    } catch {
      return { ...item, url: "" };
    }
  });
  return { ...payload, locker: { ...payload.locker, items } };
};

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const { element, width, height } = buildLockerImage(absolute(body, request));
  return new ImageResponse(element, { width, height, fonts: await interFonts() });
}
