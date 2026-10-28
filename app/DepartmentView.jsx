"use client";

import { useEffect, useState } from "react";
import { Building2 } from "lucide-react";
import { useAuth } from "./auth";
const CHEVRON = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238C8398' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`;


/* Switches a page between departments.

   Only a member of an admin department sees it, because everyone else is
   already limited to their own department by the API. Pass the chosen id back
   and refetch with ?department=<id>. */
export default function DepartmentView({ value, onChange }) {
  const { department } = useAuth();
  const [departments, setDepartments] = useState([]);

  useEffect(() => {
    if (!department?.admin) return;
    fetch("/api/departments", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => setDepartments(body?.departments || []))
      .catch(() => {});
  }, [department]);

  if (!department?.admin || departments.length < 2) return null;

  return (
    <div className="inline-flex items-center gap-2">
      <Building2 size={15} style={{ color: "var(--muted)" }} />
      <select value={value || "all"} onChange={(e) => onChange(e.target.value)}
        className="rounded-full px-3 py-2 text-sm outline-none cursor-pointer"
        style={{
          background: "var(--card)", border: "1px solid var(--border)", color: "var(--text)",
          WebkitAppearance: "none", MozAppearance: "none", appearance: "none",
          backgroundImage: CHEVRON, backgroundRepeat: "no-repeat",
          backgroundPosition: "right 14px center", paddingRight: 38,
        }}>
        <option value="all">All departments</option>
        {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
      </select>
    </div>
  );
}
