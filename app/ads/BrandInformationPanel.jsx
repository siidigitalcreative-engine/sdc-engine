"use client";

import { useEffect, useState } from "react";
import { BookOpen, Plus, Save, Trash2, Loader2 } from "lucide-react";

const emptyBrand = () => ({
  id: crypto.randomUUID(), name: "", overview: "", mission: "", personality: "", tone: "",
  audience: "", positioning: "", sellingPoints: "", messaging: "", visuals: "", dos: "",
  donts: "", productFacts: "", collections: [],
});
const fields = [
  ["overview", "Brand Overview & Background"], ["mission", "Mission, Vision & Values"],
  ["personality", "Personality & Positioning"], ["tone", "Tone of Voice & Communication Style"],
  ["audience", "Target Audience & Personas"], ["positioning", "Differentiators / Positioning"],
  ["sellingPoints", "Key Selling Points"], ["messaging", "Approved Messages & Claims"],
  ["visuals", "Visual Identity & Creative Guidelines"], ["dos", "Creative Do's"],
  ["donts", "Creative Don'ts"], ["productFacts", "Additional Brand / Product Facts"],
];
const card = { background: "var(--card)", border: "1px solid var(--border)" };
const input = "w-full rounded-xl px-3 py-2.5 outline-none text-sm border";

export default function BrandInformationPanel({ onSaved }) {
  const [brands, setBrands] = useState([]);
  const [selected, setSelected] = useState(null);
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [storageMissing, setStorageMissing] = useState(false);

  useEffect(() => {
    fetch("/api/ads", { cache: "no-store" }).then(r => r.json()).then(data => {
      if (data.error) throw new Error(data.error);
      setStorageMissing(!!data.storageMissing);
      setBrands(data.brands || []);
    }).catch(e => setMessage(e.message));
  }, []);

  const choose = brand => { setSelected(brand.id); setDraft(structuredClone(brand)); setMessage(""); };
  const create = () => { if (storageMissing) return; const item = emptyBrand(); setSelected(item.id); setDraft(item); setMessage(""); };
  const change = (key, value) => setDraft(v => ({ ...v, [key]: value }));
  const save = async () => {
    if (storageMissing) { setMessage("Shared storage is missing. Saving is blocked to protect your earlier profile."); return; }
    if (!draft?.name.trim()) { setMessage("Enter a brand name first."); return; }
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/ads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "saveBrand", payload: draft }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setBrands(data.brands); setMessage("Brand profile saved to shared storage."); onSaved?.();
    } catch (error) { setMessage(error.message); } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!draft || !confirm(`Delete ${draft.name || "this brand"}'s profile? Existing campaigns will retain their selections.`)) return;
    setBusy(true);
    try {
      const response = await fetch("/api/ads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "deleteBrand", payload: { id: draft.id } }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setBrands(data.brands); setDraft(null); setSelected(null); setMessage("Brand deleted."); onSaved?.();
    } catch (error) { setMessage(error.message); } finally { setBusy(false); }
  };
  const addCollection = () => change("collections", [...draft.collections, { id: crypto.randomUUID(), name: "", products: [] }]);
  const editCollection = (id, patch) => change("collections", draft.collections.map(c => c.id === id ? { ...c, ...patch } : c));
  const initialize = async () => {
    if (!confirm("Initialize an EMPTY shared Ads workspace? Do this ONLY if you have verified that no previous brand data exists in this Vercel Blob store. Cancel if a saved profile has gone missing.")) return;
    setBusy(true);
    try {
      const response = await fetch("/api/ads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "initialize", payload: null }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setStorageMissing(false); setBrands(data.brands || []); setMessage("New shared workspace initialized."); onSaved?.();
    } catch (error) { setMessage(error.message); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-5" style={{ color: "var(--text)" }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-xl font-bold">Brand Information</h2><p className="text-sm" style={{ color: "var(--muted)" }}>Manage brand profiles, collections, and product information used for planning Ads.</p></div>
        <button onClick={create} disabled={storageMissing} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white flex items-center gap-2 disabled:opacity-40" style={{ background: "linear-gradient(135deg,#FFAA62,#E53E30)" }}><Plus size={16}/> Add Brand</button>
      </div>
      {storageMissing && <div role="alert" className="rounded-xl p-4 space-y-3" style={{ background: "rgba(240,140,70,.10)", border: "1px solid #BF7F45" }}><p className="font-semibold text-sm">Shared brand data could not be found.</p><p className="text-sm">Your earlier profile may still exist in another Vercel Blob store or deployment environment. Saving is blocked so it cannot silently be replaced. Check the connected Blob store and <code>sdc/ads-workspace.json</code> before initializing anything.</p><button onClick={initialize} disabled={busy} className="text-xs underline" style={{ color: "var(--text-2)" }}>Initialize a new empty workspace only after verifying no previous data exists</button></div>}
      <div className="grid lg:grid-cols-[240px_minmax(0,1fr)] gap-4 items-start">
        <aside className="rounded-2xl p-3 space-y-2" style={card}>
          <p className="text-xs font-semibold px-2 pb-1" style={{ color: "var(--muted)" }}>BRANDS</p>
          {brands.length === 0 && <p className="text-xs px-2" style={{ color: "var(--muted)" }}>No profiles yet. Add your first brand.</p>}
          {brands.map(b => <button key={b.id} onClick={() => choose(b)} className="w-full rounded-xl px-3 py-3 text-left text-sm font-medium flex items-center gap-2" style={{ background: selected === b.id ? "var(--hover)" : "transparent", border: selected === b.id ? "1px solid var(--border)" : "1px solid transparent" }}><BookOpen size={16}/>{b.name}</button>)}
        </aside>
        {draft ? <section className="rounded-2xl p-4 sm:p-6 space-y-5" style={card}>
          <div className="flex items-center justify-between gap-2"><h2 className="font-semibold text-lg">{draft.name || "New Brand Profile"}</h2><div className="flex gap-2"><button onClick={remove} disabled={busy} className="rounded-xl px-3 py-2 text-sm flex items-center gap-2" style={{ border: "1px solid var(--border)" }}><Trash2 size={15}/> Delete</button><button onClick={save} disabled={busy} className="rounded-xl px-4 py-2 text-sm font-semibold text-white flex items-center gap-2" style={{ background: "#E65B45" }}>{busy ? <Loader2 size={15} className="animate-spin"/> : <Save size={15}/>} Save</button></div></div>
          <label className="block text-sm font-medium space-y-1">Brand Name<input value={draft.name} onChange={e => change("name", e.target.value)} className={input} style={card} placeholder="e.g. Quencha"/></label>
          <div className="grid md:grid-cols-2 gap-4">{fields.map(([key, label]) => <label key={key} className="block text-xs font-semibold space-y-1" style={{ color: "var(--text-2)" }}>{label}<textarea rows={4} value={draft[key] || ""} onChange={e => change(key, e.target.value)} className={input + " resize-y"} style={card} placeholder={`Enter ${label.toLowerCase()}...`}/></label>)}</div>
          <div className="flex justify-between items-center gap-3"><div><h3 className="font-semibold">Collections / Categories & Products</h3><p className="text-xs" style={{ color: "var(--muted)" }}>Products are entered one per line. They appear as selectable options in Ads.</p></div><button onClick={addCollection} className="px-3 py-2 rounded-xl text-sm flex items-center gap-1" style={{ border: "1px solid var(--border)" }}><Plus size={15}/> Collection</button></div>
          <div className="space-y-3">{draft.collections.map(c => <div key={c.id} className="rounded-xl p-3 grid md:grid-cols-[1fr_1.5fr_auto] gap-3 items-start" style={{ background: "var(--col)" }}><label className="text-xs space-y-1">Collection / Category<input className={input} value={c.name} onChange={e => editCollection(c.id, { name: e.target.value })} style={card}/></label><label className="text-xs space-y-1">Products (one per line)<textarea rows={3} className={input} value={(c.products || []).join("\n")} onChange={e => editCollection(c.id, { products: e.target.value.split("\n") })} style={card}/></label><button aria-label="Remove collection" onClick={() => change("collections", draft.collections.filter(x => x.id !== c.id))} className="p-2 rounded-lg" style={{ color: "#E87970" }}><Trash2 size={17}/></button></div>)}</div>
          <button onClick={save} disabled={busy} className="px-5 py-2.5 rounded-xl text-white text-sm font-semibold" style={{ background: "#E65B45" }}>Save Brand Profile</button>
        </section> : <div className="rounded-2xl p-10 text-center text-sm" style={{ ...card, color: "var(--muted)" }}>Choose a brand or select Add Brand to begin.</div>}
      </div>
      {message && <p role="status" className="text-sm" style={{ color: "var(--text-2)" }}>{message}</p>}
    </div>
  );
}
