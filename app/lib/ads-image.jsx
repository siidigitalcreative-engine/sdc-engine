import React from "react";

const COLORS = { ink: "#25202B", sub: "#665D6C", light: "#F7F5F4", line: "#E8E2E1", orange: "#E86146", white: "#FFFFFF" };
const money = n => `PHP ${Math.round(Number(n) || 0).toLocaleString("en-PH")}`;
const safe = value => String(value ?? "").trim();
const days = (a, b) => Math.max(1, Math.round((Date.parse(b) - Date.parse(a)) / 86400000) + 1 || 1);
const text = (value, fallback = "Not specified") => safe(value) || fallback;

function Line({ label, value }) {
  return <div style={{ display: "flex", flexDirection: "column", width: "100%", marginBottom: 12 }}>
    <span style={{ fontSize: 16, color: COLORS.sub, marginBottom: 4 }}>{label}</span>
    <span style={{ fontSize: 22, color: COLORS.ink, whiteSpace: "pre-wrap", overflowWrap: "break-word" }}>{text(value)}</span>
  </div>;
}

export function buildAdsImage({ campaign = {}, brandName = "", preset = null, pillars = [] } = {}) {
  const rows = Array.isArray(campaign.rows) ? campaign.rows.slice(0, 35) : [];
  const sceneCount = rows.reduce((sum, r) => sum + Math.min(12, Array.isArray(r?.concept?.scenes) ? r.concept.scenes.length : 0), 0);
  const height = Math.min(14000, 650 + rows.length * 375 + sceneCount * 80);
  const duration = days(campaign.start, campaign.end);
  const allocated = rows.reduce((sum, row) => sum + (Number(row.budget) || 0), 0);
  const type = campaign.budgetSource === "preset" ? preset?.type : campaign.budgetType;
  const amount = Number(campaign.budgetSource === "preset" ? preset?.amount : campaign.amount) || 0;
  const total = campaign.budgetSource === "pillars" ? allocated : type === "daily" ? amount * duration : amount;

  const element = <div style={{ display: "flex", flexDirection: "column", width: 1200, height, background: COLORS.light, color: COLORS.ink, padding: 54, fontFamily: "Inter" }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 28, borderBottom: `3px solid ${COLORS.orange}` }}>
      <div style={{ display: "flex", flexDirection: "column" }}><span style={{ color: COLORS.orange, fontSize: 21, fontWeight: 700, letterSpacing: 2 }}>SDC • ADS CAMPAIGN</span><span style={{ marginTop: 12, fontSize: 49, fontWeight: 800 }}>{text(campaign.name, "Untitled Campaign")}</span><span style={{ marginTop: 8, fontSize: 21, color: COLORS.sub }}>{text(brandName, "Brand not selected")}  •  {text(campaign.collection, "All collections")}  •  {text(campaign.product, "All products")}</span></div>
      <span style={{ background: COLORS.white, border: `1px solid ${COLORS.line}`, padding: 14, borderRadius: 14, fontSize: 20 }}>{text(campaign.status, "Draft")}</span>
    </div>
    <div style={{ display: "flex", gap: 16, marginTop: 28 }}>
      {[["TOTAL BUDGET", money(total)], ["DAILY ESTIMATE", money(total / duration)], ["DURATION", `${duration} days`], ["PLATFORM", text(campaign.platform)]].map(([label, value]) => <div key={label} style={{ display: "flex", flexDirection: "column", flex: 1, padding: 20, borderRadius: 16, background: COLORS.white, border: `1px solid ${COLORS.line}` }}><span style={{ fontSize: 14, color: COLORS.sub }}>{label}</span><span style={{ fontSize: 23, fontWeight: 700, marginTop: 8 }}>{value}</span></div>)}
    </div>
    <div style={{ display: "flex", background: COLORS.white, border: `1px solid ${COLORS.line}`, borderRadius: 18, padding: 24, marginTop: 18 }}>
      <div style={{ display: "flex", flexDirection: "column", width: "50%" }}><Line label="Objective" value={campaign.objective}/><Line label="Campaign Dates" value={`${text(campaign.start)} to ${text(campaign.end)}`}/></div>
      <div style={{ display: "flex", flexDirection: "column", width: "50%" }}><Line label="Ad Account" value={campaign.adAccount}/><Line label="Landing Page" value={campaign.landing}/></div>
    </div>
    {safe(campaign.brief) && <div style={{ display: "flex", flexDirection: "column", padding: 22, background: COLORS.white, borderRadius: 16, marginTop: 18, border: `1px solid ${COLORS.line}` }}><span style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>CREATIVE INSTRUCTIONS</span><span style={{ fontSize: 19, color: COLORS.sub, whiteSpace: "pre-wrap" }}>{campaign.brief.slice(0, 550)}</span></div>}
    <div style={{ fontSize: 26, fontWeight: 800, marginTop: 29, marginBottom: 15 }}>Content Pillars ({rows.length})</div>
    {rows.map((row, index) => {
      const pillar = pillars.find(p => p.id === row.pillar) || { name: "Content Pillar", color: COLORS.orange };
      const concept = row.concept || {};
      const scenes = Array.isArray(concept.scenes) ? concept.scenes.slice(0, 12) : [];
      return <div key={row.id || index} style={{ display: "flex", flexDirection: "column", padding: 24, marginBottom: 15, background: COLORS.white, border: `1px solid ${COLORS.line}`, borderRadius: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}><span style={{ fontWeight: 800, fontSize: 24, color: pillar.color }}>{index + 1}. {pillar.name}</span><span style={{ fontWeight: 700, fontSize: 20 }}>{money(row.budget)}  •  {text(concept.duration, "—")} sec</span></div>
        <span style={{ fontSize: 23, fontWeight: 700, marginBottom: 8 }}>{text(concept.title)}</span>
        <span style={{ fontSize: 18, color: COLORS.sub, marginBottom: 10, whiteSpace: "pre-wrap" }}>{safe(concept.summary).slice(0, 250)}</span>
        <div style={{ display: "flex", gap: 16, marginBottom: 9 }}><div style={{ display: "flex", flexDirection: "column", flex: 1 }}><span style={{ fontSize: 15, color: COLORS.sub }}>Hook / Creative Angle</span><span style={{ fontSize: 17 }}>{text(concept.hook || concept.angle).slice(0, 180)}</span></div><div style={{ display: "flex", flexDirection: "column", flex: 1 }}><span style={{ fontSize: 15, color: COLORS.sub }}>CTA</span><span style={{ fontSize: 17 }}>{text(concept.cta).slice(0, 180)}</span></div></div>
        {safe(concept.voiceover) && <span style={{ fontSize: 17, color: COLORS.ink, marginTop: 5 }}>Script / VO: {concept.voiceover.slice(0, 240)}</span>}
        {safe(row.prompt) && <span style={{ fontSize: 16, color: COLORS.sub, marginTop: 5 }}>Direction: {row.prompt.slice(0, 200)}</span>}
        {scenes.length > 0 && <div style={{ display: "flex", flexDirection: "column", marginTop: 12, borderTop: `1px solid ${COLORS.line}`, paddingTop: 10 }}><span style={{ fontSize: 17, fontWeight: 700, marginBottom: 7 }}>VIDEO OUTLINE</span>{scenes.map((s, i) => <span key={i} style={{ fontSize: 16, color: COLORS.sub, marginBottom: 5 }}>{i + 1}. {text(s.label, "Scene")} ({text(s.start, "0")}–{text(s.end, "?")}s): {text(s.visual, "Visual pending").slice(0, 125)} {safe(s.camera) ? `• ${s.camera.slice(0, 65)}` : ""}</span>)}</div>}
      </div>;
    })}
    {Array.isArray(campaign.rows) && campaign.rows.length > 35 && <span style={{ color: COLORS.sub, fontSize: 18 }}>Additional pillars not included; export a smaller campaign to see all rows.</span>}
    <div style={{ display: "flex", marginTop: "auto", justifyContent: "space-between", fontSize: 16, color: COLORS.sub }}><span>Sunbeams Digital Creative Engine</span><span>Exported {new Date().toISOString().slice(0, 10)}</span></div>
  </div>;
  return { element, width: 1200, height };
}
