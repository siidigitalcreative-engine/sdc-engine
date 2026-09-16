import { handleUpload } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { getAuthenticatedMember } from "../../lib/auth-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Handles the browser's direct-to-Blob upload flow: it issues a short-lived
// client token (after auth) so large files upload straight to Blob storage,
// bypassing the serverless request-body size limit.
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
          maximumSizeInBytes: 512 * 1024 * 1024, // 512 MB ceiling
        };
      },
      onUploadCompleted: async () => { /* nothing to persist here — the client stores the URL on the task */ },
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json({ error: error.message || "Upload failed." }, { status: 400 });
  }
}
