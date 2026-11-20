import "server-only";

import { departmentForMember, listDepartments } from "./department-store";

/* The Plug & Play pages came from SII Workspace, which names these things
   differently: access/dept there, accessLevel/department here, and a cookie
   rather than a query parameter for the chosen department. This maps one onto
   the other so those routes work unchanged. */

export const ACCESS_LEVELS = ["admin", "hod", "member"];
export const DEPT_COOKIE = "sdc_dept";

const levelOf = (m) => String(m?.accessLevel || m?.access || "").trim() || "member";
const deptOf = (m) => String(m?.department || m?.dept || "").trim();

export const isAdmin = (m) => levelOf(m) === "admin";
export const isHod = (m) => levelOf(m) === "hod";

// May this person run the department: Management, Admin and HOD Admin anywhere,
// an HOD in their own.
export function canManageDept(actor, dept) {
  return isAdmin(actor) || (isHod(actor) && deptOf(actor) === dept);
}

/* The department a request works in. Everyone else is pinned to their own; an
   admin may name another with ?department=, matching the rest of the app, and
   the old cookie is still honoured. */
export async function activeDept(request, actor) {
  const own = deptOf(actor) || (await departmentForMember(actor))?.id;
  if (!actor || !isAdmin(actor)) return own;

  const url = (() => { try { return new URL(request.url); } catch { return null; } })();
  const wanted = url?.searchParams.get("department") || request.cookies?.get?.(DEPT_COOKIE)?.value;

  if (wanted && wanted !== "all") {
    const known = await listDepartments();
    if (known.some((d) => d.id === wanted)) return wanted;
  }
  return own || (await listDepartments())[0]?.id;
}

// Who created a record, for "only the author or a manager can delete" rules.
export function canDeleteRecord(actor, dept, record) {
  if (canManageDept(actor, dept)) return true;
  return Boolean(record?.createdBy) && record.createdBy === actor.id;
}
