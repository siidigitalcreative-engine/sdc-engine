import "server-only";

import { BlobPreconditionFailedError, get, put } from "@vercel/blob";

const PATH = "sdc/ads-workspace.json";
const BACKUP_DIR = "sdc/ads-backups";

const initial = () => ({
  version: 1,
  brands: [],
  campaigns: [],
  pillarBudgets: { story: 5000, showcase: 3000, hook: 2000, value: 3000, journey: 3000, interactive: 2000, relatable: 2000, promotions: 0 },
  presets: [
    { id: "awareness", name: "Brand Awareness", type: "daily", amount: 1000 },
    { id: "discovery", name: "Product Discovery", type: "lifetime", amount: 14000 },
    { id: "engagement", name: "Engagement", type: "daily", amount: 500 },
    { id: "conversion", name: "Conversion", type: "lifetime", amount: 20000 },
  ],
});

const WRITE_OPTS = {
  access: "private",
  contentType: "application/json",
  allowOverwrite: true,
  addRandomSuffix: false,
  cacheControlMaxAge: 60,
};

// The SDK does not always throw an instance we can match, so check the name and
// the message too. Same approach as the task, member and print stores.
function isEtagConflict(error) {
  return error instanceof BlobPreconditionFailedError ||
    error?.name === "BlobPreconditionFailedError" ||
    /precondition failed|etag mismatch/i.test(String(error?.message || ""));
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function readAdsWorkspace() {
  const result = await get(PATH, { access: "private", useCache: false });
  if (!result) return { state: initial(), etag: null, missing: true };
  if (!result.stream) throw new Error("Ads workspace could not be read. Existing data was not changed.");

  const text = await new Response(result.stream).text();
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("Ads workspace is not valid JSON. Saving is blocked so nothing is overwritten.");
  }
  if (!value || typeof value !== "object") {
    throw new Error("Ads workspace is not valid. Saving is blocked so nothing is overwritten.");
  }

  // Coerce rather than refuse: a missing list is an empty list, not a reason to
  // block every save.
  return {
    state: {
      ...initial(),
      ...value,
      brands: Array.isArray(value.brands) ? value.brands : [],
      campaigns: Array.isArray(value.campaigns) ? value.campaigns : [],
      presets: Array.isArray(value.presets) ? value.presets : initial().presets,
      pillarBudgets: value.pillarBudgets && typeof value.pillarBudgets === "object"
        ? value.pillarBudgets : initial().pillarBudgets,
    },
    etag: result.blob.etag,
  };
}

function applyAction(state, action, payload) {
  const next = structuredClone(state);

  if (action === "saveBrand") {
    if (!payload?.id || !payload?.name) throw new Error("Brand name is required.");
    next.brands = [...next.brands.filter((b) => b.id !== payload.id), payload];
  } else if (action === "deleteBrand") {
    next.brands = next.brands.filter((b) => b.id !== payload?.id);
  } else if (action === "saveCampaign") {
    if (!payload?.id) throw new Error("That campaign is missing its id. Reopen it and try again.");
    if (!String(payload?.name || "").trim()) throw new Error("Campaign name is required.");
    next.campaigns = [...next.campaigns.filter((c) => c.id !== payload.id), payload];
  } else if (action === "deleteCampaign") {
    next.campaigns = next.campaigns.filter((c) => c.id !== payload?.id);
  } else if (action === "savePillarBudgets") {
    next.pillarBudgets = Object.fromEntries(
      Object.entries(payload || {}).map(([key, amount]) => [key, Math.max(0, Number(amount) || 0)])
    );
  } else if (action === "savePresets") {
    next.presets = Array.isArray(payload) ? payload : [];
  } else {
    throw new Error("Unknown action.");
  }

  next.updatedAt = new Date().toISOString();
  return next;
}

// One backup per day, overwritten within the day, so a bad save can be undone
// without the folder growing a file per attempt.
async function backup(state) {
  try {
    const day = new Date().toISOString().slice(0, 10);
    await put(`${BACKUP_DIR}/${day}.json`, JSON.stringify(state), WRITE_OPTS);
  } catch (error) {
    // A backup failure must never block the save it was protecting.
    console.error("ads-store: backup skipped", error);
  }
}

export async function updateAdsWorkspace(action, payload) {
  if (action === "initialize") {
    const current = await readAdsWorkspace();
    if (!current.missing) throw new Error("Ads workspace already exists. Nothing was initialized.");
    const fresh = { ...initial(), updatedAt: new Date().toISOString() };
    await put(PATH, JSON.stringify(fresh), WRITE_OPTS);
    return fresh;
  }

  let lastError;
  let backedUp = false;

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const { state, etag, missing } = await readAdsWorkspace();
    if (missing) {
      throw new Error("Shared Ads data is missing. Saving is blocked to protect your earlier profiles. Verify your Vercel Blob store before initializing a new workspace.");
    }

    const next = applyAction(state, action, payload);   // throws on a bad payload, before any write

    if (!backedUp) { await backup(state); backedUp = true; }

    try {
      await put(PATH, JSON.stringify(next), { ...WRITE_OPTS, ...(etag ? { ifMatch: etag } : {}) });
      return next;
    } catch (error) {
      if (!isEtagConflict(error)) throw error;
      lastError = error;
      await wait(25 * (attempt + 1));
    }
  }

  // Every guarded attempt clashed. Rebuild from the newest copy and write
  // without the guard rather than lose the edit.
  const { state } = await readAdsWorkspace();
  const finalState = applyAction(state, action, payload);
  try {
    await put(PATH, JSON.stringify(finalState), WRITE_OPTS);
    return finalState;
  } catch (error) {
    throw lastError || error;
  }
}
