import { handleUpload } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { getAuthenticatedMember } from "../../lib/auth-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Issues a short-lived client token so the browser can upload large files
// (over the ~4.5 MB server-body limit) straight to Blob storage. Used only
// for files bigger than the server route handles.
export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        const actor = await getAuthenticatedMember(request);
        if (!actor) throw new Error("Unauthorized.");
        return {
          access: "public",
          addRandomSuffix: true,
          maximumSizeInBytes: 50 * 1024 * 1024, // 50 MB ceiling
        };
      },
      onUploadCompleted: async () => { /* client stores the URL on the task */ },
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json({ error: error.message || "Upload failed." }, { status: 400 });
  }
}
