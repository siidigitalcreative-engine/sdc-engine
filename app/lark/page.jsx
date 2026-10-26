"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Send, Plus, Pencil, Trash2, CheckCircle2, AlertTriangle } from "lucide-react";

const ACCENT_GRAD = "linear-gradient(135deg,#FFAA62 0%,#E53E30 100%)";
const ON_ACCENT = "var(--on-accent)";

// What a destination can be the default for, and what that covers.
const PURPOSES = [
  { id: "tasks", name: "Tasks", note: "board, single task, daily digest" },
  { id: "calendar", name: "Calendar", note: "month schedule, single event" },
  { id: "projects", name: "Projects", note: "projects overview" },
  { id: "print", name: "Print Hub", note: "reserved for print exports" },
];

export default function LarkGroupsPage() {
  const [targets, setTargets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", webhook: "" });
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: "", webhook: "" });

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/lark-targets", { cache: "no-store" });
      if (!res.ok) throw new Error("Unable to load the destinations.");
      const body = await res.json();
      setTargets(Array.isArray(body.targets) ? body.targets : []);
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const act = async (method, body, message) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/lark-targets", {
        method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "That did not save.");
      setTargets(Array.isArray(data.targets) ? data.targets : targets);
      if (message) setNotice(message);
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const togglePurpose = (target, purpose) => {
    const next = target.defaultFor.includes(purpose)
      ? target.defaultFor.filter((p) => p !== purpose)
      : [...target.defaultFor, purpose];
    act("PATCH", { id: target.id, defaultFor: next }, "Defaults updated.");
  };

  const sendTest = async (target) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/lark-targets/test", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: target.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "The test message did not go through.");
      setNotice(`Test message sent to ${target.name}. Check the group chat.`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const field = { background: "var(--col)", border: "1px solid var(--border)", color: "var(--text)" };

  return (
    <main className="flex-1 min-w-0 flex flex-col overflow-y-auto">
      <header className="flex items-start gap-3 px-4 sm:px-7 pt-6 pb-4 shrink-0 flex-wrap">
        <div className="mr-auto">
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: "var(--text)" }}>Lark Groups</h1>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Group chats that exports can be sent to, from anywhere in the app
          </p>
          {error && <p className="text-xs mt-1" style={{ color: "#E5536E" }}>{error}</p>}
          {notice && <p className="text-xs mt-1" style={{ color: "#3FA37A" }}>{notice}</p>}
        </div>
        <button onClick={() => setAdding((v) => !v)}
          className="rounded-full px-4 py-2 text-sm font-semibold inline-flex items-center gap-2 shadow-md"
          style={{ background: ACCENT_GRAD, color: ON_ACCENT }}>
          <Plus size={16} /> Add group
        </button>
      </header>

      {adding && (
        <div className="px-4 sm:px-7 pb-4">
          <div className="rounded-2xl p-4 flex flex-col gap-2.5 max-w-xl"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Group name, e.g. Production Floor"
              className="rounded-xl px-3 py-2.5 text-sm outline-none" style={field} />
            <input value={draft.webhook} onChange={(e) => setDraft({ ...draft, webhook: e.target.value })}
              placeholder="https://open.larksuite.com/open-apis/bot/v2/hook/…"
              className="rounded-xl px-3 py-2.5 text-sm outline-none" style={field} />
            <div className="flex gap-2">
              <button disabled={busy || !draft.name.trim() || !draft.webhook.trim()}
                onClick={async () => {
                  if (await act("POST", { name: draft.name, webhook: draft.webhook }, "Group added.")) {
                    setDraft({ name: "", webhook: "" });
                    setAdding(false);
                  }
                }}
                className="rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-50"
                style={{ background: ACCENT_GRAD, color: ON_ACCENT }}>
                {busy ? "Saving…" : "Add group"}
              </button>
              <button onClick={() => setAdding(false)} className="tp-ib rounded-full px-4 py-2 text-sm font-medium"
                style={{ background: "var(--card)", color: "var(--text-2)", border: "1px solid var(--border)" }}>Cancel</button>
            </div>
            <p className="text-xs" style={{ color: "var(--faint)" }}>
              In Lark: group settings, Bots, Add Bot, Custom Bot, then copy its webhook address.
              Any https webhook is accepted, so new groups can be added here at any time.
            </p>
          </div>
        </div>
      )}

      <div className="px-4 sm:px-7 pb-8 flex flex-col gap-3">
        {loading ? (
          <Empty text="Loading destinations…" />
        ) : !targets.length ? (
          <Empty text="No group chats yet. Add one to start sending exports." />
        ) : targets.map((t) => (
          <div key={t.id} className="rounded-2xl p-4"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: t.lark ? "#FCE3D6" : "#FAEFD6" }}>
                <Send size={15} style={{ color: t.lark ? "#F26A3C" : "#E0A93C" }} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>{t.name}</p>
                <p className="text-xs" style={{ color: "var(--muted)" }}>
                  {t.host}<span style={{ color: "var(--faint)" }}> · {t.hint}</span>
                  {t.builtIn && <span style={{ color: "var(--faint)" }}> · from the environment</span>}
                </p>
              </div>
              <div className="flex items-center gap-1.5 ml-auto">
                <button onClick={() => sendTest(t)} disabled={busy}
                  className="tp-ib rounded-full px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                  style={{ background: "var(--dim)", color: "var(--text-2)" }}>Send test</button>
                {!t.builtIn && (
                  <>
                    <button onClick={() => { setEditing(editing === t.id ? null : t.id); setForm({ name: t.name, webhook: "" }); }}
                      disabled={busy} title="Edit"
                      className="tp-ib h-8 w-8 rounded-full inline-flex items-center justify-center"
                      style={{ color: "var(--text-2)" }}><Pencil size={14} /></button>
                    <button onClick={() => { if (window.confirm(`Remove ${t.name}?`)) act("DELETE", { id: t.id }, "Group removed."); }}
                      disabled={busy} title="Remove"
                      className="tp-ib h-8 w-8 rounded-full inline-flex items-center justify-center"
                      style={{ color: "#E5536E" }}><Trash2 size={14} /></button>
                  </>
                )}
              </div>
            </div>

            {!t.lark && (
              <p className="text-xs mt-2.5 flex items-center gap-1.5" style={{ color: "#E0A93C" }}>
                <AlertTriangle size={13} /> Not a Lark bot URL. Image posts will only work with a Lark custom bot.
              </p>
            )}

            {!t.builtIn && (
              <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
                <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: "var(--muted)" }}>
                  Default for
                </p>
                <div className="flex flex-wrap gap-2">
                  {PURPOSES.map((p) => {
                    const on = t.defaultFor.includes(p.id);
                    return (
                      <button key={p.id} onClick={() => togglePurpose(t, p.id)} disabled={busy} title={p.note}
                        className="rounded-full px-3 py-1.5 text-xs font-semibold inline-flex items-center gap-1.5"
                        style={on
                          ? { background: ACCENT_GRAD, color: ON_ACCENT }
                          : { background: "var(--col)", color: "var(--muted)", border: "1px solid var(--border)" }}>
                        {on && <CheckCircle2 size={13} />}{p.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {editing === t.id && (
              <div className="mt-3 flex flex-col gap-2 max-w-xl">
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Name" className="rounded-xl px-3 py-2.5 text-sm outline-none" style={field} />
                <input value={form.webhook} onChange={(e) => setForm({ ...form, webhook: e.target.value })}
                  placeholder="New webhook URL, leave blank to keep the current one"
                  className="rounded-xl px-3 py-2.5 text-sm outline-none" style={field} />
                <button disabled={busy}
                  onClick={async () => {
                    if (await act("PATCH", { id: t.id, name: form.name, webhook: form.webhook }, "Saved.")) setEditing(null);
                  }}
                  className="rounded-full px-4 py-2 text-sm font-semibold self-start disabled:opacity-50"
                  style={{ background: ACCENT_GRAD, color: ON_ACCENT }}>Save changes</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}

function Empty({ text }) {
  return (
    <div className="rounded-2xl py-16 text-center"
      style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--muted)" }}>
      <Send size={26} className="mx-auto mb-3" style={{ opacity: 0.5 }} />
      <p className="text-sm">{text}</p>
    </div>
  );
}
