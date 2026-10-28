import "server-only";

import { departmentForMember } from "./department-store";

/* Per-department views for tasks and projects.

   An admin department sees everything, and may narrow the view with a
   ?department= parameter. Everyone else only ever receives their own
   department's rows, so the filtering is enforced here rather than trusted
   to the page. */

export async function viewerScope(member, request) {
  const department = await departmentForMember(member);
  const isAdmin = Boolean(department?.admin);
  const requested = request ? new URL(request.url).searchParams.get("department") : null;

  return {
    department,
    departmentId: department?.id || "sdc",
    isAdmin,
    // Which department's rows to return: admins may ask for one or for all.
    filterId: isAdmin ? (requested && requested !== "all" ? requested : null) : (department?.id || "sdc"),
  };
}

const departmentOf = (row, fallback = "sdc") => String(row?.department || fallback).trim() || fallback;

export function filterTasks(tasks, scope) {
  if (!scope.filterId) return tasks;
  return tasks.filter((task) => departmentOf(task) === scope.filterId);
}

// Calendar events carry a department the same way tasks do.
export const filterEvents = filterTasks;

// Projects are names; their department lives in a side map.
export function filterProjects(projects, departments, scope) {
  if (!scope.filterId) return projects;
  return projects.filter((name) => departmentOf({ department: departments?.[name] }) === scope.filterId);
}
