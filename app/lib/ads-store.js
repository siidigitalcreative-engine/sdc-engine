import "server-only";

import { get, put } from "@vercel/blob";

const PATH = "sdc/ads-workspace.json";
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

export async function readAdsWorkspace() {
  const result = await get(PATH, { access: "private", useCache: false });
  if (!result) return { state: initial(), etag: null, missing: true };
  if (!result.stream) throw new Error("Ads workspace could not be read. Existing data was not changed.");
  const value = JSON.parse(await new Response(result.stream).text());
  if (!value || !Array.isArray(value.brands) || !Array.isArray(value.campaigns)) {
    throw new Error("Ads workspace contains invalid data. Saving is blocked to protect existing records.");
  }
  return { state: { ...initial(), ...value }, etag: result.blob.etag };
}

export async function updateAdsWorkspace(action, payload) {
  if (action === "initialize") {
    const current = await readAdsWorkspace();
    if (!current.missing) throw new Error("Ads workspace already exists. Nothing was initialized.");
    const fresh = { ...initial(), updatedAt: new Date().toISOString() };
    await put(PATH, JSON.stringify(fresh), {
      access: "private", contentType: "application/json", allowOverwrite: false,
      addRandomSuffix: false, cacheControlMaxAge: 60,
    });
    return fresh;
  }
  for (let attempt = 0; attempt < 8; attempt++) {
    const { state, etag, missing } = await readAdsWorkspace();
    if (missing) {
      throw new Error("Shared Ads data is missing. Saving is blocked to protect your earlier profiles. Verify your Vercel Blob store before initializing a new workspace.");
    }
    let next = structuredClone(state);
    if (action === "saveBrand") {
      const item = payload;
      if (!item?.id || !item.name) throw new Error("Brand name is required.");
      next.brands = [...next.brands.filter((b) => b.id !== item.id), item];
    } else if (action === "deleteBrand") {
      next.brands = next.brands.filter((b) => b.id !== payload.id);
    } else if (action === "saveCampaign") {
      if (!payload?.id || !payload?.name) throw new Error("Campaign name is required.");
      next.campaigns = [...next.campaigns.filter((c) => c.id !== payload.id), payload];
    } else if (action === "deleteCampaign") {
      next.campaigns = next.campaigns.filter((c) => c.id !== payload.id);
    } else if (action === "savePillarBudgets") {
      next.pillarBudgets = Object.fromEntries(Object.entries(payload).map(([key, amount]) => [key, Math.max(0, Number(amount) || 0)]));
    } else if (action === "savePresets") {
      next.presets = payload;
    } else {
      throw new Error("Unknown action.");
    }
    next.updatedAt = new Date().toISOString();
    try {
      // Keep an immutable copy of the previous state before any overwrite.
      await put(`sdc/ads-backups/${Date.now()}-${crypto.randomUUID()}.json`, JSON.stringify(state), {
        access: "private", contentType: "application/json", allowOverwrite: false,
        addRandomSuffix: false, cacheControlMaxAge: 60,
      });
      await put(PATH, JSON.stringify(next), {
        access: "private", contentType: "application/json", allowOverwrite: true,
        addRandomSuffix: false, cacheControlMaxAge: 60,
        ...(etag ? { ifMatch: etag } : {}),
      });
      return next;
    } catch (error) {
      if (/precondition|etag|already exists/i.test(String(error?.message))) continue;
      throw error;
    }
  }
  throw new Error("Another team member updated this data. Please retry.");
}
