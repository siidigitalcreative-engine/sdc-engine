"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Calendar, CheckSquare, Folder, Users, BarChart, Settings, Sparkles, Moon, Sun } from "lucide-react";
import { useTheme } from "./theme";

const ACCENT_GRAD = "linear-gradient(135deg,#FFAA62 0%,#E53E30 100%)";
const ON_ACCENT = "var(--on-accent)";
const ME = { i: "CN", name: "Che Navarro", role: "Digital Creative", c: "#7C6FF0" };
const NAV = [
  { href: "/dashboard", name: "Dashboard", icon: LayoutGrid },
  { href: "/calendar", name: "Calendar", icon: Calendar },
  { href: "/tasks", name: "Tasks", icon: CheckSquare },
  { href: "/projects", name: "Projects", icon: Folder },
  { href: "/team", name: "Team Members", icon: Users },
  { href: "/reports", name: "Reports", icon: BarChart },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { dark, toggle } = useTheme();
  return (
    <aside className="w-64 shrink-0 hidden md:flex flex-col gap-5 p-4 overflow-y-auto overflow-x-hidden" style={{ background: "var(--sidebar)", borderRight: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between px-1 pt-1">
        <div className="flex items-center gap-2.5">
          <span className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: ACCENT_GRAD }}><Sparkles size={18} style={{ color: ON_ACCENT }} /></span>
          <div className="leading-tight">
            <p className="font-semibold" style={{ fontSize: 15, color: "var(--text)" }}>SDC</p>
            <p className="text-xs" style={{ color: "var(--muted)" }}>Creative team</p>
          </div>
        </div>
        <button onClick={toggle} aria-label="Toggle theme" className="sb-ib h-8 w-8 flex items-center justify-center rounded-full" style={{ color: "var(--text-2)" }}>{dark ? <Sun size={16} /> : <Moon size={16} />}</button>
      </div>

      <div className="flex flex-col items-center text-center py-3 rounded-2xl" style={{ background: "var(--col)", border: "1px solid var(--border)" }}>
        <span className="h-14 w-14 rounded-full flex items-center justify-center text-white font-semibold mb-2" style={{ background: ME.c, fontSize: 20, border: "3px solid var(--border)" }}>{ME.i}</span>
        <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>{ME.name}</p>
        <p className="text-xs" style={{ color: "var(--muted)" }}>{ME.role}</p>
      </div>

      <nav className="flex flex-col gap-1">
        {NAV.map((n) => {
          const on = pathname === n.href;
          const Icon = n.icon;
          return (
            <Link key={n.href} href={n.href} className="sb-nav flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium" style={on ? { background: ACCENT_GRAD, color: ON_ACCENT } : { color: "var(--text-2)" }}>
              <Icon size={18} /> {n.name}
            </Link>
          );
        })}
      </nav>

      <Link href="/settings" className="sb-nav mt-auto flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium" style={{ color: "var(--text-2)" }}>
        <Settings size={18} /> Settings
      </Link>
    </aside>
  );
}
