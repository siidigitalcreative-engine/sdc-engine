import "server-only";

import { BlobPreconditionFailedError, get, put } from "@vercel/blob";

const PATHNAME = "sdc/app-settings.json";

const DEFAULTS = {
  name: "SDC",
  tagline: "Creative team",
  signInTitle: "",          // falls back to "Welcome to <name>"
  signInSubtitle: "Sign in to your creative team workspace",
};

const clean = (value, max) => String(value ?? "").trim().replace(/\s+/g, " ").slice(0, max);

function normalize(raw) {
  return {
    version: 1,
    updatedAt: raw?.updatedAt || new Date().toISOString(),
    name: clean(raw?.name, 40) || DEFAULTS.name,
    tagline: clean(raw?.tagline, 60) || DEFAULTS.tagline,
    signInTitle: clean(raw?.signInTitle, 80),
    signInSubtitle: clean(raw?.signInSubtitle, 120) || DEFAULTS.signInSubtitle,
  };
}

const WRITE_OPTS = {
  access: "private",
  contentType: "application/json",
  allowOverwrite: true,
  addRandomSuffix: false,
  cacheControlMaxAge: 0,
};

function isEtagConflict(error) {
  return error instanceof BlobPreconditionFailedError ||
    error?.name === "BlobPreconditionFailedError" ||
    /precondition failed|etag mismatch/i.test(String(error?.message || ""));
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function readAppSettings() {
  const result = await get(PATHNAME, { access: "private", useCache: false, cacheControlMaxAge: 0 });
  if (!result?.stream) return { settings: normalize(DEFAULTS), etag: null };
  const text = await new Response(result.stream).text();
  try {
    return { settings: normalize(JSON.parse(text)), etag: result.blob.etag };
  } catch {
    return { settings: normalize(DEFAULTS), etag: result.blob.etag };
  }
}

export async function updateAppSettings(patch) {
  let lastError;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const current = await readAppSettings();
    const next = normalize({ ...current.settings, ...patch, updatedAt: new Date().toISOString() });
    try {
      await put(PATHNAME, JSON.stringify(next), {
        ...WRITE_OPTS, ...(current.etag ? { ifMatch: current.etag } : {}),
      });
      return next;
    } catch (error) {
      if (!isEtagConflict(error)) throw error;
      lastError = error;
      await wait(25 * (attempt + 1));
    }
  }
  const latest = await readAppSettings();
  const finalSettings = normalize({ ...latest.settings, ...patch, updatedAt: new Date().toISOString() });
  try {
    await put(PATHNAME, JSON.stringify(finalSettings), WRITE_OPTS);
    return finalSettings;
  } catch (error) {
    throw lastError || error;
  }
}
