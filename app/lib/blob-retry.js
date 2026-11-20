import "server-only";

import { BlobPreconditionFailedError } from "@vercel/blob";

// Vercel Blob rejects a conditional write ("ifMatch") when someone else saved
// the same file in between — "Precondition failed: ETag mismatch." That's
// normal with several people using the app at once: re-read, re-apply, retry.
// Matched by message as well as class, because the class identity can differ
// between bundles.
export function isEtagConflict(error) {
  return error instanceof BlobPreconditionFailedError
    || error?.name === "BlobPreconditionFailedError"
    || /precondition failed|etag mismatch/i.test(String(error?.message || ""));
}

// Growing, randomised pause so simultaneous savers don't keep colliding.
export function backoff(attempt) {
  const ms = Math.min(1200, 40 * 2 ** attempt) + Math.random() * 80;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Kept short: if the store still reports a conflict after this many fresh
// re-reads, each store falls back to re-applying the change to the newest copy
// and saving it unconditionally, so a person's save never fails on this.
export const MAX_ATTEMPTS = 6;
