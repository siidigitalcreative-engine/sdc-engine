import { createMultipartUpload, uploadPart, completeMultipartUpload } from "@vercel/blob";
import { NextResponse } from "next/server";
import { getAuthenticatedMember } from "../../lib/auth-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Chunked multipart upload, proxied entirely through the server so the browser
// never talks to Vercel's Blob host directly (which was CORS-blocked here).
// The client slices the file into small parts; each request stays under the
// serverless body limit, and parts are assembled into one Blob.
export async function POST(request) {
  const actor = await getAuthenticatedMember(request);
  if (!actor) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");
  const token = process.env.BLOB_READ_WRITE_TOKEN;

  try {
    if (action === "start") {
      const { name, contentType } = await request.json();
      const safe = String(name || "file").replace(/[^\w.\-]+/g, "_").slice(0, 120);
      const pathname = `sdc/attachments/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
      const mp = await createMultipartUpload(pathname, {
        access: "public",
        addRandomSuffix: false,
        contentType: contentType || undefined,
        token,
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
      const part = await uploadPart(pathname, buf, { access: "public", key, uploadId, partNumber, token });
      return NextResponse.json({ etag: part.etag, partNumber: part.partNumber ?? partNumber });
    }

    if (action === "complete") {
      const { pathname, key, uploadId, parts } = await request.json();
      if (!pathname || !key || !uploadId || !Array.isArray(parts)) {
        return NextResponse.json({ error: "Missing complete parameters." }, { status: 400 });
      }
      const result = await completeMultipartUpload(pathname, parts, { access: "public", key, uploadId, token });
      return NextResponse.json({ url: result.url });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    console.error("POST /api/upload", action, error);
    return NextResponse.json({ error: error.message || "Upload failed." }, { status: 500 });
  }
}
