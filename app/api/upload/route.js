import { createMultipartUpload, uploadPart, completeMultipartUpload } from "@vercel/blob";
import { NextResponse } from "next/server";
import { getAuthenticatedMember } from "../../lib/auth-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Chunked multipart upload, proxied through the server (no direct browser→Blob
// call). Files are stored with access "private" (which this store supports —
// same as task/project data) and served back via /api/attachments/<pathname>,
// giving a stable public link that Lark and Base can open.
export async function POST(request) {
  const actor = await getAuthenticatedMember(request);
  if (!actor) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  try {
    if (action === "start") {
      const { name, contentType } = await request.json();
      const safe = String(name || "file").replace(/[^\w.\-]+/g, "_").slice(0, 120);
      const pathname = `sdc/attachments/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
      const mp = await createMultipartUpload(pathname, {
        access: "private",
        addRandomSuffix: false,
        contentType: contentType || undefined,
      });
      return NextResponse.json({ pathname, key: mp.key, uploadId: mp.uploadId });
    }

    if (action === "part") {
      const pathname = searchParams.get("pathname");
      const key = searchParams.get("key");
      const uploadId = searchParams.get("uploadId");
      const partNumber = Number(searchParams.get("partNumber"));
      if (!pathname || !key || !uploadId || !partNumber) {
        return NextResponse.json({ error: "Missing part parameters." }, { status: 400 });
      }
      const buf = Buffer.from(await request.arrayBuffer());
      const part = await uploadPart(pathname, buf, { access: "private", key, uploadId, partNumber });
      return NextResponse.json({ etag: part.etag, partNumber: part.partNumber ?? partNumber });
    }

    if (action === "complete") {
      const { pathname, key, uploadId, parts } = await request.json();
      if (!pathname || !key || !uploadId || !Array.isArray(parts)) {
        return NextResponse.json({ error: "Missing complete parameters." }, { status: 400 });
      }
      const result = await completeMultipartUpload(pathname, parts, { access: "private", key, uploadId });
      const origin = new URL(request.url).origin;
      const proxyUrl = `${origin}/api/attachments/${result.pathname || pathname}`;
      return NextResponse.json({ url: proxyUrl, pathname: result.pathname || pathname });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    console.error("POST /api/upload", action, error);
    return NextResponse.json({ error: error.message || "Upload failed." }, { status: 500 });
  }
}
