export const APP_TIME_ZONE = "Asia/Manila";

export function toDate(value) {
  if (value instanceof Date) return value;
  return new Date(value);
}

export function zonedDateParts(value, timeZone = APP_TIME_ZONE) {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const get = (type) => Number(parts.find((part) => part.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

export function zonedDateKey(value, timeZone = APP_TIME_ZONE) {
  const parts = zonedDateParts(value, timeZone);
  if (!parts) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

export function formatInAppTimeZone(value, options = {}, fallback = "") {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat("en-US", {
    ...options,
    timeZone: APP_TIME_ZONE,
  }).format(date);
}
