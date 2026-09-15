"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole, Sparkles, ArrowRight, Moon, Sun } from "lucide-react";
import { useAuth } from "../auth";
import { useTheme } from "../theme";

const ACCENT_GRAD = "linear-gradient(135deg,#FFAA62 0%,#E53E30 100%)";
const ON_ACCENT = "var(--on-accent)";

export default function LoginPage() {
  const router = useRouter();
  const { members, login, defaultPin } = useAuth();
  const { dark, toggle } = useTheme();
  const [memberId, setMemberId] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!memberId && members[0]) setMemberId(members[0].id);
  }, [members, memberId]);

  const selected = members.find((m) => m.id === memberId);

  const submit = (e) => {
    e.preventDefault();
    setError("");
    const result = login(memberId, pin);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    router.replace("/dashboard");
  };

  return (
    <main className="flex-1 min-w-0 overflow-y-auto relative">
      <button onClick={toggle} aria-label="Toggle theme" className="absolute right-6 top-6 h-10 w-10 rounded-full flex items-center justify-center" style={{ color: "var(--text-2)", background: "var(--col)", border: "1px solid var(--border)" }}>
        {dark ? <Sun size={17} /> : <Moon size={17} />}
      </button>

      <div className="min-h-full flex items-center justify-center p-6">
        <div className="w-full" style={{ maxWidth: 460 }}>
          <div className="text-center mb-7">
            <span className="mx-auto h-12 w-12 rounded-2xl flex items-center justify-center shadow-lg" style={{ background: ACCENT_GRAD }}>
              <Sparkles size={22} style={{ color: ON_ACCENT }} />
            </span>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight" style={{ color: "var(--text)" }}>Welcome to SDC</h1>
            <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>Sign in to your creative team workspace</p>
          </div>

          <form onSubmit={submit} className="rounded-3xl p-6 sm:p-7 shadow-xl" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
            <label className="text-sm font-medium" style={{ color: "var(--text)" }}>Team member</label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-3 mb-5">
              {members.map((m) => {
                const active = m.id === memberId;
                return (
                  <button key={m.id} type="button" onClick={() => { setMemberId(m.id); setError(""); }} className="rounded-2xl px-2 py-3 flex flex-col items-center gap-2" style={{ background: active ? "var(--col)" : "transparent", border: active ? "1px solid var(--border)" : "1px solid transparent" }} title={m.name}>
                    <span className="h-10 w-10 rounded-full flex items-center justify-center text-white text-xs font-semibold" style={{ background: m.c }}>{m.i}</span>
                    <span className="text-xs truncate w-full" style={{ color: active ? "var(--text)" : "var(--muted)" }}>{m.name.split(" ")[0]}</span>
                  </button>
                );
              })}
            </div>

            {selected && (
              <div className="flex items-center gap-3 rounded-2xl p-3 mb-5" style={{ background: "var(--col)" }}>
                <span className="h-11 w-11 rounded-full flex items-center justify-center text-white font-semibold shrink-0" style={{ background: selected.c }}>{selected.i}</span>
                <div className="min-w-0">
                  <p className="font-semibold truncate" style={{ color: "var(--text)" }}>{selected.name}</p>
                  <p className="text-xs truncate" style={{ color: "var(--muted)" }}>{selected.role}</p>
                </div>
              </div>
            )}

            <label className="text-sm font-medium" style={{ color: "var(--text)" }}>PIN</label>
            <div className="relative mt-2">
              <LockKeyhole size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "var(--muted)" }} />
              <input
                value={pin}
                onChange={(e) => { setPin(e.target.value.replace(/\D/g, "").slice(0, 8)); setError(""); }}
                inputMode="numeric"
                type="password"
                placeholder="Enter your PIN"
                autoComplete="current-password"
                className="w-full rounded-2xl py-3 pl-10 pr-4 outline-none"
                style={{ background: "var(--surface)", border: `1px solid ${error ? "#E5536E" : "var(--border)"}` }}
              />
            </div>
            {error && <p className="text-xs mt-2" style={{ color: "#E5536E" }}>{error}</p>}

            <button type="submit" className="mt-5 w-full rounded-2xl py-3 font-semibold flex items-center justify-center gap-2 shadow-md" style={{ background: ACCENT_GRAD, color: ON_ACCENT }}>
              Sign in <ArrowRight size={17} />
            </button>

            <p className="text-xs text-center mt-4" style={{ color: "var(--muted)" }}>
              Starter accounts use PIN <strong style={{ color: "var(--text-2)" }}>{defaultPin}</strong>. You can change each member's PIN from Team Members.
            </p>
          </form>
        </div>
      </div>
    </main>
  );
}
