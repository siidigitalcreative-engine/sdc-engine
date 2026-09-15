"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Plus, Search, MoreHorizontal, Pencil, Trash2, X, UserPlus, Save, AlertTriangle,
} from "lucide-react";
import { useAuth } from "../auth";
import { useTheme } from "../theme";

const ACCENT_GRAD = "linear-gradient(135deg,#FFAA62 0%,#E53E30 100%)";
const ON_ACCENT = "var(--on-accent)";
const STRIP = ["#7C6FF0", "#3FA37A", "#F0784B", "#E0A93C", "#E5536E"];
const STATUS_C = { Active: "#3FA37A", Online: "#3FA37A", Away: "#E0A93C", Offline: "#8E8A96" };
const STATUS_OPTIONS = ["Active", "Online", "Away", "Offline"];
const COLOR_OPTIONS = ["#7C6FF0", "#3FA37A", "#F0784B", "#E0A93C", "#E5536E", "#3E8ED0", "#A85AD7", "#29A7A1"];

const EMPTY_FORM = {
  name: "",
  i: "",
  role: "",
  loc: "Manila",
  status: "Active",
  projects: 0,
  open: 0,
  done: 0,
  c: "#7C6FF0",
  pin: "",
};

function makeInitials(name) {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");
}

export default function TeamPage() {
  const { members, currentMember, addMember, updateMember, deleteMember } = useAuth();
  const { dark } = useTheme();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const list = members.filter((m) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return `${m.name} ${m.role} ${m.loc} ${m.status}`.toLowerCase().includes(q);
  });

  return (
    <>
      <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <header className="flex items-center gap-3 px-6 pt-6 pb-4 shrink-0 flex-wrap">
          <div className="mr-auto">
            <h1 className="text-2xl font-semibold tracking-tight" style={{ color: "var(--text)" }}>Team Members</h1>
            <p className="text-sm" style={{ color: "var(--muted)" }}>{members.length} {members.length === 1 ? "person" : "people"} on the creative team</p>
          </div>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted)" }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              className="pl-8 pr-3 py-2 text-sm rounded-full outline-none shadow-sm w-40"
              style={{ background: "var(--card)", border: "1px solid var(--border)" }}
            />
          </div>
          <button onClick={() => setAdding(true)} className="tm-pill flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium shadow-md" style={{ background: ACCENT_GRAD, color: ON_ACCENT }}>
            <Plus size={17} /> Add member
          </button>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
          {list.length ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 20 }}>
              {list.map((m) => (
                <MemberCard
                  key={m.id}
                  m={m}
                  dark={dark}
                  isCurrent={currentMember?.id === m.id}
                  onEdit={() => setEditing(m)}
                  onDelete={() => setDeleting(m)}
                />
              ))}
            </div>
          ) : (
            <div className="h-48 rounded-2xl flex items-center justify-center text-sm" style={{ color: "var(--muted)", border: "1px dashed var(--border)" }}>
              No team members match your search.
            </div>
          )}
        </div>
      </main>

      {(adding || editing) && (
        <MemberModal
          member={editing}
          onClose={() => { setAdding(false); setEditing(null); }}
          onSave={(data) => {
            if (editing) updateMember(editing.id, data);
            else addMember(data);
            setAdding(false);
            setEditing(null);
          }}
        />
      )}

      {deleting && (
        <DeleteModal
          member={deleting}
          blocked={currentMember?.id === deleting.id}
          onClose={() => setDeleting(null)}
          onDelete={() => {
            deleteMember(deleting.id);
            setDeleting(null);
          }}
        />
      )}
    </>
  );
}

function MemberCard({ m, dark, isCurrent, onEdit, onDelete }) {
  const [menu, setMenu] = useState(false);
  const menuRef = useRef(null);
  const total = m.open + m.done;
  const pct = total ? Math.round((m.done / total) * 100) : 0;
  const featured = !!m.featured && dark;
  const t = featured
    ? { bg: "#101014", border: "1px solid rgba(255,255,255,0.08)", text: "#FFFFFF", muted: "rgba(255,255,255,0.45)", inner: "#101014", track: "rgba(255,255,255,0.08)", ibbg: "rgba(255,255,255,0.10)", ibcolor: "#fff" }
    : { bg: "var(--card)", border: "1px solid var(--border)", text: "var(--text)", muted: "var(--muted)", inner: "var(--card)", track: "var(--grid)", ibbg: "var(--col)", ibcolor: "var(--text-2)" };

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const cells = [
    { v: m.projects, l: "Projects" },
    { v: m.open, l: "Open tasks" },
    { v: m.done, l: "Completed" },
    { v: m.loc, l: "Based in" },
    { v: m.status, l: "Status", dot: STATUS_C[m.status] },
    { v: pct + "%", l: "Completion" },
  ];

  return (
    <div className="tm-card rounded-2xl p-5 relative overflow-visible" style={{ background: t.bg, border: t.border }}>
      <div className="flex gap-1 mb-5">
        {STRIP.map((c, i) => <span key={i} style={{ height: 4, width: 20, borderRadius: 4, background: c, opacity: 0.9 }} />)}
      </div>

      <div ref={menuRef} className="absolute" style={{ top: 16, right: 16, zIndex: 20 }}>
        <button
          onClick={() => setMenu((v) => !v)}
          className="tm-ib rounded-full flex items-center justify-center"
          title="Member options"
          style={{ height: 32, width: 32, background: t.ibbg, color: t.ibcolor, border: featured ? "none" : "1px solid var(--border)" }}
        >
          <MoreHorizontal size={17} />
        </button>
        {menu && (
          <div className="absolute right-0 mt-2 rounded-xl p-1.5 shadow-xl" style={{ width: 145, background: "var(--card)", border: "1px solid var(--border)" }}>
            <button onClick={() => { setMenu(false); onEdit(); }} className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-left" style={{ color: "var(--text-2)" }}>
              <Pencil size={14} /> Edit member
            </button>
            <button onClick={() => { setMenu(false); onDelete(); }} className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-left" style={{ color: isCurrent ? "var(--faint)" : "#E5536E" }}>
              <Trash2 size={14} /> {isCurrent ? "Current account" : "Delete member"}
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col items-center text-center">
        <div style={{ width: 76, height: 76, borderRadius: "50%", padding: 4, background: `conic-gradient(from -90deg, ${m.c} 0% ${pct}%, ${t.track} ${pct}% 100%)` }}>
          <div style={{ width: "100%", height: "100%", borderRadius: "50%", padding: 3, background: t.inner }}>
            <div style={{ width: "100%", height: "100%", borderRadius: "50%", background: m.c, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 600 }}>{m.i}</div>
          </div>
        </div>
        <p className="font-semibold mt-3" style={{ color: t.text, fontSize: 16 }}>{m.name}</p>
        <p className="text-xs mt-0.5" style={{ color: t.muted }}>{m.role}</p>
        {isCurrent && <span className="mt-2 rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: "rgba(242,106,60,0.13)", color: "#F26A3C" }}>You</span>}
      </div>

      <div className="grid grid-cols-3 gap-y-4 mt-5">
        {cells.map((c, i) => (
          <div key={i} className="text-center px-1 min-w-0">
            <div
              className="font-semibold flex items-center justify-center gap-1 leading-tight min-w-0"
              style={{
                color: t.text,
                fontSize: i >= 3 ? 13 : 14,
                minHeight: 20,
                whiteSpace: i >= 3 ? "normal" : "nowrap",
                overflowWrap: "anywhere",
              }}
            >
              {c.dot && <span style={{ height: 7, width: 7, borderRadius: "50%", background: c.dot, display: "inline-block", flex: "0 0 auto" }} />}
              <span className="min-w-0">{c.v}</span>
            </div>
            <div className="text-xs mt-0.5" style={{ color: t.muted }}>{c.l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MemberModal({ member, onClose, onSave }) {
  const [form, setForm] = useState(() => member ? { ...member, pin: "" } : { ...EMPTY_FORM });
  const [error, setError] = useState("");

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const submit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return setError("Member name is required.");
    if (!form.role.trim()) return setError("Role is required.");
    if (!member && !form.pin.trim()) return setError("Create a login PIN for this member.");
    if (form.pin && form.pin.length < 4) return setError("PIN must be at least 4 digits.");

    onSave({
      ...form,
      i: (form.i || makeInitials(form.name) || "TM").toUpperCase().slice(0, 3),
      pin: form.pin,
      projects: Math.max(0, Number(form.projects) || 0),
      open: Math.max(0, Number(form.open) || 0),
      done: Math.max(0, Number(form.done) || 0),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}>
      <form onSubmit={submit} className="w-full rounded-3xl shadow-2xl overflow-hidden" style={{ maxWidth: 650, maxHeight: "90vh", background: "var(--card)", border: "1px solid var(--border)" }}>
        <div className="flex items-center gap-3 px-6 py-5" style={{ borderBottom: "1px solid var(--border)" }}>
          <span className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(242,106,60,0.14)", color: "#F26A3C" }}>
            {member ? <Pencil size={18} /> : <UserPlus size={18} />}
          </span>
          <div className="mr-auto">
            <h2 className="font-semibold" style={{ color: "var(--text)", fontSize: 18 }}>{member ? "Edit team member" : "Add team member"}</h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>{member ? "Update the member card and login details." : "Create a member card and a simple PIN login."}</p>
          </div>
          <button type="button" onClick={onClose} className="h-9 w-9 rounded-full flex items-center justify-center" style={{ color: "var(--text-2)", background: "var(--col)" }}><X size={17} /></button>
        </div>

        <div className="p-6 overflow-y-auto" style={{ maxHeight: "calc(90vh - 150px)" }}>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Full name">
              <input value={form.name} onChange={(e) => { set("name", e.target.value); setError(""); }} placeholder="e.g. Che Navarro" className="w-full rounded-xl px-3 py-2.5 outline-none" style={inputStyle} />
            </Field>
            <Field label="Initials / code">
              <input value={form.i} onChange={(e) => set("i", e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 3))} placeholder="CN" className="w-full rounded-xl px-3 py-2.5 outline-none" style={inputStyle} />
            </Field>
            <Field label="Role">
              <input value={form.role} onChange={(e) => { set("role", e.target.value); setError(""); }} placeholder="Digital Creative" className="w-full rounded-xl px-3 py-2.5 outline-none" style={inputStyle} />
            </Field>
            <Field label="Location">
              <input value={form.loc} onChange={(e) => set("loc", e.target.value)} placeholder="Manila" className="w-full rounded-xl px-3 py-2.5 outline-none" style={inputStyle} />
            </Field>
            <Field label="Status">
              <select value={form.status} onChange={(e) => set("status", e.target.value)} className="w-full rounded-xl px-3 py-2.5 outline-none" style={inputStyle}>
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label={member ? "New PIN (optional)" : "Login PIN"} hint={member ? "Leave blank to keep the current PIN." : "Minimum 4 digits."}>
              <input value={form.pin} onChange={(e) => { set("pin", e.target.value.replace(/\D/g, "").slice(0, 8)); setError(""); }} inputMode="numeric" type="password" placeholder={member ? "Keep current PIN" : "4–8 digits"} className="w-full rounded-xl px-3 py-2.5 outline-none" style={inputStyle} />
            </Field>
          </div>

          <div className="mt-5">
            <p className="text-sm font-medium mb-2" style={{ color: "var(--text)" }}>Card color</p>
            <div className="flex flex-wrap items-center gap-2">
              {COLOR_OPTIONS.map((c) => (
                <button key={c} type="button" onClick={() => set("c", c)} className="h-8 w-8 rounded-full" style={{ background: c, boxShadow: form.c === c ? "0 0 0 3px var(--card), 0 0 0 5px #F26A3C" : "none" }} aria-label={`Use color ${c}`} />
              ))}
              <input type="color" value={form.c} onChange={(e) => set("c", e.target.value)} className="h-8 w-10 rounded-lg p-0 border-0 cursor-pointer" title="Custom color" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-5">
            <NumberField label="Projects" value={form.projects} onChange={(v) => set("projects", v)} />
            <NumberField label="Open tasks" value={form.open} onChange={(v) => set("open", v)} />
            <NumberField label="Completed" value={form.done} onChange={(v) => set("done", v)} />
          </div>

          {error && <p className="text-sm mt-4" style={{ color: "#E5536E" }}>{error}</p>}
        </div>

        <div className="flex justify-end gap-2 px-6 py-4" style={{ borderTop: "1px solid var(--border)" }}>
          <button type="button" onClick={onClose} className="rounded-full px-4 py-2 text-sm font-medium" style={{ color: "var(--text-2)", background: "var(--col)" }}>Cancel</button>
          <button type="submit" className="rounded-full px-4 py-2 text-sm font-medium flex items-center gap-2 shadow-md" style={{ background: ACCENT_GRAD, color: ON_ACCENT }}>
            <Save size={15} /> {member ? "Save changes" : "Add member"}
          </button>
        </div>
      </form>
    </div>
  );
}

function DeleteModal({ member, blocked, onClose, onDelete }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}>
      <div className="w-full rounded-3xl p-6 shadow-2xl" style={{ maxWidth: 430, background: "var(--card)", border: "1px solid var(--border)" }}>
        <span className="h-11 w-11 rounded-2xl flex items-center justify-center" style={{ background: "rgba(229,83,110,0.13)", color: "#E5536E" }}><AlertTriangle size={20} /></span>
        <h2 className="font-semibold mt-4" style={{ color: "var(--text)", fontSize: 19 }}>{blocked ? "You can't delete this account" : "Delete team member?"}</h2>
        <p className="text-sm mt-2 leading-6" style={{ color: "var(--muted)" }}>
          {blocked
            ? "This is the account you're currently signed in with. Sign in as another member first if you need to delete it."
            : `This will remove ${member.name}'s member card and login from this SDC workspace.`}
        </p>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="rounded-full px-4 py-2 text-sm font-medium" style={{ color: "var(--text-2)", background: "var(--col)" }}>{blocked ? "Close" : "Cancel"}</button>
          {!blocked && <button onClick={onDelete} className="rounded-full px-4 py-2 text-sm font-medium text-white" style={{ background: "#E5536E" }}>Delete member</button>}
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="text-sm font-medium" style={{ color: "var(--text)" }}>{label}</span>
      {hint && <span className="text-xs ml-2" style={{ color: "var(--muted)" }}>{hint}</span>}
      <div className="mt-2">{children}</div>
    </label>
  );
}

function NumberField({ label, value, onChange }) {
  return (
    <label className="block">
      <span className="text-xs" style={{ color: "var(--muted)" }}>{label}</span>
      <input type="number" min="0" value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-xl px-3 py-2.5 outline-none" style={inputStyle} />
    </label>
  );
}

const inputStyle = { background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" };
