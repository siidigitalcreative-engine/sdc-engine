import { NextResponse } from "next/server";
import { getAuthenticatedMember } from "../../../lib/auth-token";

export const runtime = "nodejs";

export async function POST(request) {
  if (!await getAuthenticatedMember(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "Set OPENAI_API_KEY on the server to enable AI generation." }, { status: 503 });
  try {
    const { mode, brand, collection, product, campaign, pillar, customPrompt } = await request.json();
    const base = [
      "You are a professional advertising creative strategist for a Philippine e-commerce brand.",
      "Use ONLY the brand/product facts supplied. Do not invent specifications, awards, warranty, or health claims.",
      "Brand profile: " + JSON.stringify(brand || {}),
      "Collection/category: " + (collection || "All"),
      "Product: " + (product || "All"),
      "Campaign details: " + JSON.stringify(campaign || {}),
    ].join("\n");
    const instructions = mode === "brief"
      ? base + "\nReturn ONLY valid JSON containing a single string field named instructions. Write a specific, editable campaign creative brief with audience, tone, feel, creative direction, and CTA."
      : base + "\nPillar: " + pillar + "\nPillar-specific user instructions: " + (customPrompt || "None") +
        "\nReturn ONLY valid JSON with these exact fields: title (string), summary (string), hook (string), angle (string), voiceover (string), cta (string), duration (positive integer seconds), format (string), scenes (array of objects with start, end, label, visual, camera strings). Timings must be continuous and end at duration. Include a useful scene-by-scene VIDEO OUTLINE with camera movements and transitions. Align with pillar purpose and campaign brief.";
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: process.env.OPENAI_ADS_MODEL || "gpt-5-mini", input: instructions, max_output_tokens: 2800 }),
      signal: AbortSignal.timeout(60000),
    });
    const data = await response.json();
    if (!response.ok) return NextResponse.json({ error: data.error?.message || "AI request failed." }, { status: 502 });
    const output = (data.output || []).flatMap(x => x.content || []).filter(x => x.type === "output_text").map(x => x.text).join("\n");
    const cleaned = output.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    return NextResponse.json({ result: JSON.parse(cleaned) });
  } catch (error) {
    console.error("POST /api/ads/generate", error);
    return NextResponse.json({ error: "Unable to generate. Please retry or edit manually." }, { status: 502 });
  }
}
