"use client";

import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import PageAccess from "../PageAccess";
import DepartmentView from "../DepartmentView";
import Lockers from "../Lockers";
import { useAuth } from "../auth";

const ACCENT = "linear-gradient(135deg,#FFAA62 0%,#E53E30 100%)";

function LockersInner() {
  const { department } = useAuth();

  /* Its own department picker now that this is a page of its own, rather than
     borrowing the one inside Plug & Play. */
  const [deptView, setDeptView] = useState("");
  useEffect(() => {
    if (!deptView && department?.id) setDeptView(department.id);
  }, [department, deptView]);

  return (
    <main className="flex-1 min-w-0 min-h-0 flex flex-col">
      <header className="px-4 sm:px-7 pt-5 sm:pt-6 pb-4 shrink-0 flex items-start gap-3 flex-wrap">
        <span className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: ACCENT, color: "var(--on-accent)" }}>
          <Lock size={18} />
        </span>
        <div className="mr-auto min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: "var(--text)" }}>Lockers</h1>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            One ad per locker: its images, videos and copy on a board you arrange, with a read-only link to share it.
          </p>
        </div>
        <DepartmentView value={deptView} onChange={setDeptView} />
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-7 pb-8">
        <Lockers deptView={deptView} />
      </div>
    </main>
  );
}

export default function LockersPage() {
  return (
    <PageAccess page="lockers">
      <LockersInner />
    </PageAccess>
  );
}
