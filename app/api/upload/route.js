import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { getAuthenticatedMember } from "../../lib/auth-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Server-proxied upload: the browser posts the file here (same-origin, no CORS),
// and we store it in Blob using the read-write token that already works for reads.
// Vercel caps a function's request body at ~4.5 MB, so this handles images/docs;
// very large files (e.g. long videos) need the direct-to-Blob client flow.
const MAX = 4 * 1024 * 1024; // 4 MB safety margin under Vercel's body limit

export async function POST(request) {
  try {
    const actor = await getAuthenticatedMember(request);
    if (!actor) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const form = await request.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") return NextResponse.json({ error: "No file provided." }, { status: 400 });
    if (file.size > MAX) return NextResponse.json({ error: "File is larger than the 4 MB upload limit." }, { status: 413 });

    const safe = String(file.name || "file").replace(/[^\w.\-]+/g, "_").slice(0, 120);
    const key = `sdc/attachments/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
    const blob = await put(key, file, {
      access: "public",
      addRandomSuffix: false,
      contentType: file.type || undefined,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    return NextResponse.json({ name: file.name, size: file.size, url: blob.url, contentType: file.type || "" });
  } catch (error) {
    console.error("POST /api/upload", error);
    return NextResponse.json({ error: error.message || "Upload failed." }, { status: 500 });
  }
}
