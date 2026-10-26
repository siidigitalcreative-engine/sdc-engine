"use client";

import { useEffect, useState } from "react";
import { BookOpen, Plus, Save, Trash2, Loader2, Pencil, Eye, Users, MessageCircle, Palette, Package, Fingerprint, X } from "lucide-react";

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
const sections = [
  { id: "identity", name: "Brand Identity", icon: Fingerprint, keys: ["overview", "mission", "personality"] },
  { id: "audience", name: "Audience & Positioning", icon: Users, keys: ["audience", "positioning", "sellingPoints"] },
  { id: "voice", name: "Voice & Messaging", icon: MessageCircle, keys: ["tone", "messaging"] },
  { id: "creative", name: "Creative Guidelines", icon: Palette, keys: ["visuals", "dos", "donts", "productFacts"] },
  { id: "products", name: "Collections & Products", icon: Package, keys: [] },
];

export default function BrandInformationPanel({ onSaved }) {
  const [brands, setBrands] = useState([]);
  const [selected, setSelected] = useState(null);
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [storageMissing, setStorageMissing] = useState(false);
  const [mode, setMode] = useState("view");
  const [section, setSection] = useState("identity");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    fetch("/api/ads", { cache: "no-store" }).then(r => r.json()).then(data => {
      if (data.error) throw new Error(data.error);
      setStorageMissing(!!data.storageMissing);
      setBrands(data.brands || []);
      if (data.brands?.length) { setSelected(data.brands[0].id); setDraft(structuredClone(data.brands[0])); }
    }).catch(e => setMessage(e.message));
  }, []);

  const discardAllowed = () => !dirty || confirm("Discard unsaved brand profile changes?");
  const choose = brand => { if (!discardAllowed()) return; setSelected(brand.id); setDraft(structuredClone(brand)); setMode("view"); setSection("identity"); setDirty(false); setMessage(""); };
  const create = () => { if (storageMissing || !discardAllowed()) return; const item = emptyBrand(); setSelected(item.id); setDraft(item); setMode("edit"); setSection("identity"); setDirty(false); setMessage(""); };
  const change = (key, value) => { setDraft(v => ({ ...v, [key]: value })); setDirty(true); };
  const cancelEdit = () => { const saved = brands.find(b => b.id === selected); if (saved) { setDraft(structuredClone(saved)); setMode("view"); } else { setDraft(null); setSelected(null); } setDirty(false); setMessage(""); };
  const save = async () => {
    if (storageMissing) { setMessage("Shared storage is missing. Saving is blocked to protect your earlier profile."); return; }
    if (!draft?.name.trim()) { setMessage("Enter a brand name first."); return; }
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/ads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "saveBrand", payload: draft }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setBrands(data.brands); setMode("view"); setDirty(false); setMessage("Brand profile saved to shared storage."); onSaved?.();
    } catch (error) { setMessage(error.message); } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!draft || !confirm(`Delete ${draft.name || "this brand"}'s profile? Existing campaigns will retain their selections.`)) return;
    setBusy(true);
    try {
      const response = await fetch("/api/ads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "deleteBrand", payload: { id: draft.id } }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setBrands(data.brands); setDraft(null); setSelected(null); setMode("view"); setDirty(false); setMessage("Brand deleted."); onSaved?.();
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

  const activeSection = sections.find(s => s.id === section) || sections[0];
  const savedBrand = brands.some(b => b.id === selected);
  const beginEdit = () => { setMode("edit"); setMessage(""); };
  const display = value => typeof value === "string" && value.trim() ? value : null;

  return (
    <div className="space-y-5" style={{ color: "var(--text)" }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-xl font-bold">Brand Information</h2><p className="text-sm" style={{ color: "var(--muted)" }}>Manage brand profiles, collections, and product information used for planning Ads.</p></div>
        <button onClick={create} disabled={storageMissing} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white flex items-center gap-2 disabled:opacity-40" style={{ background: "linear-gradient(135deg,#FFAA62,#E53E30)" }}><Plus size={16}/> Add Brand</button>
      </div>
      {storageMissing && <div role="alert" className="rounded-xl p-4 space-y-3" style={{ background: "rgba(240,140,70,.10)", border: "1px solid #BF7F45" }}><p className="font-semibold text-sm">Shared brand data could not be found.</p><p className="text-sm">Your earlier profile may still exist in another Vercel Blob store or deployment environment. Saving is blocked so it cannot silently be replaced. Check the connected Blob store and <code>sdc/ads-workspace.json</code> before initializing anything.</p><button onClick={initialize} disabled={busy} className="text-xs underline" style={{ color: "var(--text-2)" }}>Initialize a new empty workspace only after verifying no previous data exists</button></div>}
      <div className="grid lg:grid-cols-[240px_minmax(0,1fr)] gap-4 items-start">
        <aside className="rounded-2xl p-3 space-y-2" style={card}>
          <div className="flex items-center justify-between px-2 pb-1"><p className="text-xs font-semibold tracking-wider" style={{ color: "var(--muted)" }}>BRAND LIBRARY</p><span className="text-xs rounded-full px-2 py-0.5" style={{ background: "var(--col)", color: "var(--muted)" }}>{brands.length}</span></div>
          {brands.length === 0 && <p className="text-xs px-2" style={{ color: "var(--muted)" }}>No profiles yet. Add your first brand.</p>}
          {brands.map(b => <button key={b.id} onClick={() => choose(b)} className="w-full rounded-xl px-3 py-3 text-left text-sm font-medium flex items-center gap-3" style={{ background: selected === b.id ? "var(--hover)" : "transparent", border: selected === b.id ? "1px solid var(--border)" : "1px solid transparent" }}><span className="rounded-lg w-8 h-8 flex items-center justify-center shrink-0" style={{ background: "var(--col)" }}><BookOpen size={15}/></span><span className="min-w-0"><span className="block truncate">{b.name || "Unnamed Brand"}</span><span className="block text-xs font-normal" style={{ color: "var(--muted)" }}>Brand profile</span></span></button>)}
        </aside>
        {draft ? <section className="rounded-2xl overflow-hidden" style={card}>
          <div className="p-5 sm:p-7 flex flex-wrap items-start justify-between gap-4" style={{ background: "var(--col)", borderBottom: "1px solid var(--border)" }}>
            <div className="flex gap-4 items-center min-w-0"><div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 text-xl font-bold" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>{(draft.name || "B").slice(0,1).toUpperCase()}</div><div className="min-w-0"><p className="text-xs font-semibold tracking-widest uppercase mb-1" style={{ color: "var(--muted)" }}>Brand Profile</p><h2 className="text-2xl font-bold break-words">{draft.name || "New Brand Profile"}</h2><p className="text-xs mt-1" style={{ color: "var(--muted)" }}>{mode === "view" ? "Profile overview · Select a section below to explore" : "Editing brand profile · Changes are saved only when you press Save"}</p></div></div>
            <div className="flex flex-wrap gap-2">{mode === "view" ? <button onClick={beginEdit} className="rounded-xl px-4 py-2 text-sm font-semibold flex items-center gap-2 text-white" style={{ background: "#E65B45" }}><Pencil size={15}/> Edit Profile</button> : <><button onClick={cancelEdit} disabled={busy} className="rounded-xl px-3 py-2 text-sm flex items-center gap-2" style={{ border: "1px solid var(--border)" }}><X size={15}/> Cancel</button>{savedBrand && <button onClick={remove} disabled={busy} title="Delete this saved brand profile" className="rounded-xl px-3 py-2 text-sm flex items-center gap-2" style={{ color: "#E87970", border: "1px solid var(--border)" }}><Trash2 size={15}/> Delete</button>}<button onClick={save} disabled={busy || storageMissing} className="rounded-xl px-4 py-2 text-sm font-semibold flex items-center gap-2 text-white disabled:opacity-40" style={{ background: "#E65B45" }}>{busy ? <Loader2 size={15} className="animate-spin"/> : <Save size={15}/>} Save Profile</button></>}</div>
          </div>
          <div className="flex flex-wrap gap-2 p-3 sm:px-5" style={{ borderBottom: "1px solid var(--border)" }}>{sections.map(s => { const Icon = s.icon; return <button key={s.id} onClick={() => setSection(s.id)} className="rounded-xl px-3 py-2 text-xs sm:text-sm font-medium flex items-center gap-2" style={{ background: section === s.id ? "var(--hover)" : "transparent", border: section === s.id ? "1px solid var(--border)" : "1px solid transparent", color: section === s.id ? "var(--text)" : "var(--muted)" }}><Icon size={15}/>{s.name}</button>; })}</div>
          <div className="p-4 sm:p-7 space-y-5 min-h-[300px]">
            {mode === "edit" && section === "identity" && <label className="block space-y-2 text-sm font-semibold">Brand Name<input value={draft.name || ""} onChange={e => change("name", e.target.value)} className={input} style={card} placeholder="e.g. Quencha"/></label>}
            <div><p className="text-xs uppercase font-semibold tracking-wider" style={{ color: "var(--muted)" }}>{mode === "view" ? "Profile details" : "Edit details"}</p><h3 className="text-xl font-bold mt-1">{activeSection.name}</h3></div>
            {section !== "products" && <div className="grid gap-4">{activeSection.keys.map(key => { const label = fields.find(f => f[0] === key)?.[1] || key; return <div key={key} className="rounded-2xl p-4 sm:p-5 space-y-3" style={{ border: "1px solid var(--border)" }}><h4 className="text-sm font-semibold">{label}</h4>{mode === "edit" ? <textarea rows={5} value={draft[key] || ""} onChange={e => change(key, e.target.value)} className={input + " resize-y"} style={card} placeholder={`Enter ${label.toLowerCase()}...`}/> : <p className="text-sm leading-7" style={{ color: display(draft[key]) ? "var(--text-2)" : "var(--muted)", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{display(draft[key]) || "Not added yet."}</p>}</div>; })}</div>}
            {section === "products" && <div className="space-y-4"><div className="flex flex-wrap justify-between gap-3 items-center"><p className="text-sm" style={{ color: "var(--muted)" }}>Collections and products linked to this brand. These are used as selectable options in Ads.</p>{mode === "edit" && <button onClick={addCollection} className="px-3 py-2 rounded-xl text-sm flex items-center gap-1" style={{ border: "1px solid var(--border)" }}><Plus size={15}/> Add Collection</button>}</div>{(draft.collections || []).length === 0 && <div className="rounded-xl p-6 text-sm" style={{ background: "var(--col)", color: "var(--muted)" }}>No collections added yet.</div>}{(draft.collections || []).map((c, i) => <div key={c.id || i} className="rounded-2xl p-4 sm:p-5 space-y-3" style={{ border: "1px solid var(--border)" }}>{mode === "edit" ? <div className="grid md:grid-cols-[1fr_1.4fr_auto] gap-3 items-start"><label className="text-xs space-y-2">Collection / Category<input className={input} value={c.name || ""} onChange={e => editCollection(c.id, { name: e.target.value })} style={card}/></label><label className="text-xs space-y-2">Products (one per line)<textarea rows={4} className={input} value={(c.products || []).join("\n")} onChange={e => editCollection(c.id, { products: e.target.value.split("\n") })} style={card}/></label><button aria-label="Remove collection" onClick={() => change("collections", draft.collections.filter(x => x.id !== c.id))} className="p-2 rounded-lg" style={{ color: "#E87970" }}><Trash2 size={17}/></button></div> : <><h4 className="text-sm font-bold">{c.name || "Unnamed Collection"}</h4><div className="flex flex-wrap gap-2">{(c.products || []).filter(p => typeof p === "string" && p.trim()).length ? c.products.filter(p => typeof p === "string" && p.trim()).map((p, j) => <span key={j} className="rounded-lg px-3 py-2 text-xs" style={{ background: "var(--col)" }}>{p}</span>) : <span className="text-sm" style={{ color: "var(--muted)" }}>No products yet.</span>}</div></>}</div>)}</div>}
            {mode === "edit" && <div className="flex flex-wrap gap-2 pt-2"><button onClick={save} disabled={busy || storageMissing} className="rounded-xl px-5 py-2.5 text-sm font-semibold flex items-center gap-2 text-white disabled:opacity-40" style={{ background: "#E65B45" }}><Save size={15}/> Save Brand Profile</button><button onClick={cancelEdit} disabled={busy} className="rounded-xl px-4 py-2.5 text-sm" style={{ border: "1px solid var(--border)" }}>Cancel</button></div>}
          </div>
        </section> : <div className="rounded-2xl p-10 text-center text-sm" style={{ ...card, color: "var(--muted)" }}>Choose a brand or select Add Brand to begin.</div>}
      </div>
      {message && <p role="status" className="text-sm" style={{ color: "var(--text-2)" }}>{message}</p>}
    </div>
  );
}
