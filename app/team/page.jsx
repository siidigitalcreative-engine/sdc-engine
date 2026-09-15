"use client";

import React, { useState } from "react";
import {
  LayoutGrid, Calendar as CalIcon, CheckSquare, Folder, Users, BarChart, Settings,
  Moon, Sun, Sparkles, Plus, ArrowUpRight, Search,
} from "lucide-react";

const CANVAS = "var(--surface)";
const SIDEBAR = "var(--sidebar)";
const ACCENT = "#F26A3C";
const ON_ACCENT = "var(--on-accent)";
const ACCENT_GRAD = "linear-gradient(135deg,#FFAA62 0%,#E53E30 100%)";
const PAGE_BG = "var(--page)";
const ME = { i: "CN", name: "Che Navarro", role: "Digital Creative", c: "#7C6FF0" };

const NAV = [
  { id: "dashboard", name: "Dashboard", icon: LayoutGrid },
  { id: "calendar", name: "Calendar", icon: CalIcon },
  { id: "tasks", name: "Tasks", icon: CheckSquare },
  { id: "projects", name: "Projects", icon: Folder },
  { id: "team", name: "Team Members", icon: Users },
  { id: "reports", name: "Reports", icon: BarChart },
];

const STRIP = ["#7C6FF0", "#3FA37A", "#F0784B", "#E0A93C", "#E5536E"];
const STATUS_C = { Active: "#3FA37A", Online: "#3FA37A", Away: "#E0A93C", Offline: "#8E8A96" };

const MEMBERS = [
  { i: "CN", name: "Che Navarro", role: "Digital Creative Lead", c: "#7C6FF0", loc: "Manila", projects: 6, open: 4, done: 12, status: "Active" },
  { i: "RG", name: "Ravi Gurnamal", role: "Team Manager", c: "#3FA37A", loc: "Manila", projects: 9, open: 3, done: 20, status: "Online", featured: true },
  { i: "MA", name: "Maya Alonzo", role: "Product Designer", c: "#F0784B", loc: "Cebu", projects: 4, open: 5, done: 9, status: "Active" },
  { i: "JL", name: "Jules Lim", role: "Motion Designer", c: "#E0A93C", loc: "Manila", projects: 3, open: 2, done: 7, status: "Away" },
  { i: "SP", name: "Sofia Perez", role: "Content Lead", c: "#E5536E", loc: "Davao", projects: 5, open: 6, done: 14, status: "Active" },
  { i: "DT", name: "Diego Tan", role: "Web Developer", c: "#3E8ED0", loc: "Manila", projects: 4, open: 3, done: 11, status: "Active" },
];

const STYLES = `
.theme-light{
  --page:linear-gradient(165deg,#F4F5F7 0%,#EDEEF1 100%);
  --surface:#FFFFFF; --sidebar:#F6F7F9;
  --card:#FFFFFF; --col:#F4F5F7; --border:#E9EAEE; --grid:#EDEEF2; --dim:rgba(17,17,20,0.02);
  --text:#111014; --text-2:#5B5D66; --muted:#9A9CA6; --faint:#C4C6CE;
  --hover:rgba(17,17,20,0.05); color-scheme:light; --on-accent:#ffffff;
}
.theme-dark{
  --page:linear-gradient(165deg,#0D0D10 0%,#111114 100%);
  --surface:#141417; --sidebar:#0D0D0F;
  --card:#1C1C21; --col:#171719; --border:rgba(255,255,255,0.08); --grid:rgba(255,255,255,0.10); --dim:rgba(255,255,255,0.03);
  --text:#F1F1F4; --text-2:var(--text-2); --muted:rgba(255,255,255,0.40); --faint:rgba(255,255,255,0.28);
  --hover:rgba(255,255,255,0.08); color-scheme:dark; --on-accent:#2A2210;
}
input,textarea,select{background:transparent;color:var(--text)}
input::placeholder{color:var(--muted)}
.tm-nav:hover{background:var(--hover)}
.tm-ib:hover{background:var(--hover)}
.tm-pill:hover{filter:brightness(1.05)}
.tm-card{transition:box-shadow .15s ease, transform .15s ease}
.tm-card:hover{box-shadow:0 10px 30px rgba(20,15,40,0.10); transform:translateY(-2px)}
`;

export default function TeamPage() {
  const [dark, setDark] = useState(true);
  const [query, setQuery] = useState("");
  const list = MEMBERS.filter((m) => !query.trim() || (m.name + m.role).toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div className={`h-screen p-3 sm:p-5 ${dark ? "theme-dark" : "theme-light"}`} style={{ minHeight: 560, background: PAGE_BG, color: "var(--text)", fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{STYLES}</style>
      <div className="h-full rounded-3xl overflow-hidden shadow-2xl flex" style={{ background: CANVAS }}>

        {/* ===== shared sidebar ===== */}
        <aside className="w-64 shrink-0 hidden md:flex flex-col gap-5 p-4 overflow-y-auto overflow-x-hidden" style={{ background: SIDEBAR, borderRight: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2.5 px-1 pt-1">
            <span className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: ACCENT_GRAD }}><Sparkles size={18} style={{ color: ON_ACCENT }} /></span>
            <div className="leading-tight">
              <p className="font-semibold" style={{ fontSize: 15, color: "var(--text)" }}>SDC</p>
              <p style={{ color: "var(--muted)" }} className="text-xs">Creative team</p>
            </div>
          </div>
          <div className="flex flex-col items-center text-center py-3 rounded-2xl" style={{ background: "var(--col)", border: "1px solid var(--border)" }}>
            <span className="h-14 w-14 rounded-full flex items-center justify-center text-white font-semibold mb-2" style={{ background: ME.c, fontSize: 20, border: "3px solid var(--border)" }}>{ME.i}</span>
            <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>{ME.name}</p>
            <p style={{ color: "var(--muted)" }} className="text-xs">{ME.role}</p>
          </div>
          <nav className="flex flex-col gap-1">
            {NAV.map((n) => { const on = n.id === "team"; const Icon = n.icon; return (
              <button key={n.id} className="tm-nav flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-left" style={on ? { background: ACCENT_GRAD, color: ON_ACCENT } : { color: "var(--text-2)" }}>
                <Icon size={18} /> {n.name}
              </button>
            ); })}
          </nav>
          <button className="tm-nav mt-auto flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-left" style={{ color: "var(--text-2)" }}>
            <Settings size={18} /> Settings
          </button>
        </aside>

        {/* ===== main ===== */}
        <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
          <header className="flex items-center gap-3 px-6 pt-6 pb-4 shrink-0 flex-wrap">
            <div className="mr-auto">
              <h1 className="text-2xl font-semibold tracking-tight" style={{ color: "var(--text)" }}>Team Members</h1>
              <p className="text-sm" style={{ color: "var(--muted)" }}>{MEMBERS.length} people on the creative team</p>
            </div>
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted)" }} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search"
                className="pl-8 pr-3 py-2 text-sm rounded-full outline-none shadow-sm w-40" style={{ background: "var(--card)", border: "1px solid var(--border)" }} />
            </div>
            <button onClick={() => setDark((d) => !d)} aria-label="Toggle theme" className="tm-ib h-9 w-9 flex items-center justify-center rounded-full shadow-sm" style={{ background: "var(--card)", color: "var(--text)", border: "1px solid var(--border)" }}>{dark ? <Sun size={17} /> : <Moon size={17} />}</button>
            <button className="tm-pill flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium shadow-md" style={{ background: ACCENT_GRAD, color: ON_ACCENT }}><Plus size={17} /> Invite</button>
          </header>

          <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 20 }}>
              {list.map((m) => <MemberCard key={m.i} m={m} />)}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function MemberCard({ m }) {
  const total = m.open + m.done;
  const pct = total ? Math.round((m.done / total) * 100) : 0;
  const featured = !!m.featured;
  const t = featured
    ? { bg: "#101014", border: "rgba(255,255,255,0.08)", text: "#FFFFFF", muted: "var(--muted)", inner: "#101014", track: "var(--border)", ibbg: "rgba(255,255,255,0.10)", ibcolor: "#fff" }
    : { bg: "var(--card)", border: "1px solid var(--border)", text: "var(--text)", muted: "var(--muted)", inner: "var(--card)", track: "var(--grid)", ibbg: "var(--col)", ibcolor: "var(--text-2)" };

  const cells = [
    { v: m.projects, l: "Projects" }, { v: m.open, l: "Open tasks" }, { v: m.done, l: "Completed" },
    { v: m.loc, l: "Based in" }, { v: m.status, l: "Status", dot: STATUS_C[m.status] }, { v: pct + "%", l: "Completion" },
  ];

  return (
    <div className="tm-card rounded-2xl p-5 relative overflow-hidden" style={{ background: t.bg, border: t.border }}>
      <div className="flex gap-1 mb-5">
        {STRIP.map((c, i) => <span key={i} style={{ height: 4, width: 20, borderRadius: 4, background: c, opacity: 0.9 }} />)}
      </div>

      <button className="tm-ib absolute rounded-full flex items-center justify-center" title="View profile"
        style={{ top: 16, right: 16, height: 32, width: 32, background: t.ibbg, color: t.ibcolor, border: featured ? "none" : "1px solid var(--border)" }}>
        <ArrowUpRight size={16} />
      </button>

      <div className="flex flex-col items-center text-center">
        <div style={{ width: 76, height: 76, borderRadius: "50%", padding: 4, background: `conic-gradient(from -90deg, ${m.c} 0% ${pct}%, ${t.track} ${pct}% 100%)` }}>
          <div style={{ width: "100%", height: "100%", borderRadius: "50%", padding: 3, background: t.inner }}>
            <div style={{ width: "100%", height: "100%", borderRadius: "50%", background: m.c, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 600 }}>{m.i}</div>
          </div>
        </div>
        <p className="font-semibold mt-3" style={{ color: t.text, fontSize: 16 }}>{m.name}</p>
        <p className="text-xs mt-0.5" style={{ color: t.muted }}>{m.role}</p>
      </div>

      <div className="grid grid-cols-3 gap-y-4 mt-5">
        {cells.map((c, i) => (
          <div key={i} className="text-center px-1">
            <div className="font-semibold flex items-center justify-center gap-1 truncate" style={{ color: t.text, fontSize: 14 }}>
              {c.dot && <span style={{ height: 7, width: 7, borderRadius: "50%", background: c.dot, display: "inline-block" }} />}
              {c.v}
            </div>
            <div className="text-xs mt-0.5" style={{ color: t.muted }}>{c.l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
