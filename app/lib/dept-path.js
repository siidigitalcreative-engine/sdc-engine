import "server-only";

// The original SDC (Digital Creative) department keeps its data exactly where
// it has always been — sdc/*.json — so upgrading needs no data migration.
// Every other department gets its own folder: depts/<id>/*.json.
export const LEGACY_DEPT = "sdc";
const ID_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;

export function isValidDeptId(id) {
  return ID_RE.test(String(id || ""));
}

export function deptBlobPath(dept, file) {
  const d = String(dept || LEGACY_DEPT);
  if (d === LEGACY_DEPT) return `sdc/${file}.json`;
  if (!isValidDeptId(d)) throw new Error("Invalid department.");
  return `depts/${d}/${file}.json`;
}
