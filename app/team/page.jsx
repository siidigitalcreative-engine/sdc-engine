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



export default function TeamPage() {
  const [query, setQuery] = useState("");
  const list = MEMBERS.filter((m) => !query.trim() || (m.name + m.role).toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <>
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
            <button className="tm-pill flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium shadow-md" style={{ background: ACCENT_GRAD, color: ON_ACCENT }}><Plus size={17} /> Invite</button>
          </header>

          <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 20 }}>
              {list.map((m) => <MemberCard key={m.i} m={m} />)}
            </div>
          </div>
        </main>
    </>
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
