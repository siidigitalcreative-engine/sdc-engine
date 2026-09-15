"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "sdc-members-v1";
const SESSION_KEY = "sdc-session-member-id";
const DEFAULT_PIN = "1234";

const DEFAULT_MEMBERS = [
  { id: "cn", i: "CN", name: "Che Navarro", role: "Digital Creative Lead", c: "#7C6FF0", loc: "Manila", projects: 6, open: 4, done: 12, status: "Active", pin: DEFAULT_PIN },
  { id: "rg", i: "RG", name: "Ravi Gurnamal", role: "Team Manager", c: "#3FA37A", loc: "Manila", projects: 9, open: 3, done: 20, status: "Online", featured: true, pin: DEFAULT_PIN },
  { id: "ma", i: "MA", name: "Maya Alonzo", role: "Product Designer", c: "#F0784B", loc: "Cebu", projects: 4, open: 5, done: 9, status: "Active", pin: DEFAULT_PIN },
  { id: "jl", i: "JL", name: "Jules Lim", role: "Motion Designer", c: "#E0A93C", loc: "Manila", projects: 3, open: 2, done: 7, status: "Away", pin: DEFAULT_PIN },
  { id: "sp", i: "SP", name: "Sofia Perez", role: "Content Lead", c: "#E5536E", loc: "Davao", projects: 5, open: 6, done: 14, status: "Active", pin: DEFAULT_PIN },
  { id: "dt", i: "DT", name: "Diego Tan", role: "Web Developer", c: "#3E8ED0", loc: "Manila", projects: 4, open: 3, done: 11, status: "Active", pin: DEFAULT_PIN },
];

const AuthCtx = createContext(null);

function makeId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `member-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function initialsFromName(name = "") {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "TM";
}

function cleanMember(member) {
  return {
    id: member.id || makeId(),
    i: String(member.i || initialsFromName(member.name)).trim().toUpperCase().slice(0, 3),
    name: String(member.name || "Team Member").trim(),
    role: String(member.role || "Creative Team").trim(),
    c: member.c || "#7C6FF0",
    loc: String(member.loc || "Manila").trim(),
    projects: Number(member.projects) || 0,
    open: Number(member.open) || 0,
    done: Number(member.done) || 0,
    status: member.status || "Active",
    featured: Boolean(member.featured),
    pin: String(member.pin || DEFAULT_PIN),
  };
}

export function AuthProvider({ children }) {
  const [members, setMembers] = useState(DEFAULT_MEMBERS);
  const [sessionId, setSessionId] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const parsed = stored ? JSON.parse(stored) : null;
      const initialMembers = Array.isArray(parsed) && parsed.length ? parsed.map(cleanMember) : DEFAULT_MEMBERS;
      setMembers(initialMembers);
      if (!stored) localStorage.setItem(STORAGE_KEY, JSON.stringify(initialMembers));

      const savedSession = localStorage.getItem(SESSION_KEY);
      if (savedSession && initialMembers.some((m) => m.id === savedSession)) setSessionId(savedSession);
      else localStorage.removeItem(SESSION_KEY);
    } catch {
      setMembers(DEFAULT_MEMBERS);
    } finally {
      setReady(true);
    }
  }, []);

  const currentMember = useMemo(
    () => members.find((m) => m.id === sessionId) || null,
    [members, sessionId]
  );

  const saveMembers = (nextMembers) => {
    const cleaned = nextMembers.map(cleanMember);
    setMembers(cleaned);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned)); } catch {}
    return cleaned;
  };

  const login = (memberId, pin) => {
    const member = members.find((m) => m.id === memberId);
    if (!member) return { ok: false, message: "Select a team member." };
    if (String(pin) !== String(member.pin)) return { ok: false, message: "Incorrect PIN. Please try again." };
    setSessionId(member.id);
    try { localStorage.setItem(SESSION_KEY, member.id); } catch {}
    return { ok: true, member };
  };

  const logout = () => {
    setSessionId(null);
    try { localStorage.removeItem(SESSION_KEY); } catch {}
  };

  const addMember = (data) => {
    const next = cleanMember({ ...data, id: makeId(), pin: data.pin || DEFAULT_PIN });
    saveMembers([...members, next]);
    return next;
  };

  const updateMember = (id, data) => {
    const existing = members.find((m) => m.id === id);
    if (!existing) return null;
    const merged = cleanMember({ ...existing, ...data, id, pin: data.pin ? data.pin : existing.pin });
    saveMembers(members.map((m) => (m.id === id ? merged : m)));
    return merged;
  };

  const deleteMember = (id) => {
    saveMembers(members.filter((m) => m.id !== id));
    if (sessionId === id) logout();
  };

  const value = {
    ready,
    members,
    currentMember,
    login,
    logout,
    addMember,
    updateMember,
    deleteMember,
    defaultPin: DEFAULT_PIN,
  };

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const value = useContext(AuthCtx);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
