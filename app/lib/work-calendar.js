// The SII work week, used by both the server and the Plug & Play page, so a
// target date never depends on who is looking at it.
//
//   Mon-Fri        8:00 AM - 6:36 PM
//   last day of the week   7:00 AM - 5:36 PM   (Friday, or Thursday when Friday is off)
//   breaks         12:00-12:45 lunch, 3:00-3:15 afternoon
//
// Both shifts come to 9.6 working hours, so "1 day" of duration means 9.6 hours
// of work and "1 week" means 48.

export const SHIFT = {
  normal: { start: 8 * 60, end: 18 * 60 + 36 },
  last: { start: 7 * 60, end: 17 * 60 + 36 },
};

export const BREAKS = [
  { start: 12 * 60, end: 12 * 60 + 45 },
  { start: 15 * 60, end: 15 * 60 + 15 },
];

// Philippine holidays — Proclamation No. 1006 (2026), plus Proclamation No. 1447
// (16-18 Nov 2026, NCR only, for the 49th ASEAN Summit). The EDSA anniversary on
// 25 February is a special WORKING day and is deliberately absent.
// Islamic holidays are proclaimed separately each year and get added here.
export const HOLIDAYS = {
  "2026-01-01": "New Year's Day",
  "2026-02-17": "Chinese New Year",
  "2026-04-02": "Maundy Thursday",
  "2026-04-03": "Good Friday",
  "2026-04-04": "Black Saturday",
  "2026-04-09": "Araw ng Kagitingan",
  "2026-05-01": "Labor Day",
  "2026-06-12": "Independence Day",
  "2026-08-21": "Ninoy Aquino Day",
  "2026-08-31": "National Heroes Day",
  "2026-11-01": "All Saints' Day",
  "2026-11-02": "All Souls' Day",
  "2026-11-16": "ASEAN Summit (NCR)",
  "2026-11-17": "ASEAN Summit (NCR)",
  "2026-11-18": "ASEAN Summit (NCR)",
  "2026-11-30": "Bonifacio Day",
  "2026-12-08": "Immaculate Conception",
  "2026-12-24": "Christmas Eve",
  "2026-12-25": "Christmas Day",
  "2026-12-30": "Rizal Day",
  "2026-12-31": "Last Day of the Year",
};

const breakMinutesIn = (shift) =>
  BREAKS.reduce((n, b) => n + Math.max(0, Math.min(shift.end, b.end) - Math.max(shift.start, b.start)), 0);

export const DAY_MINUTES = SHIFT.normal.end - SHIFT.normal.start - breakMinutesIn(SHIFT.normal); // 576 = 9.6h
export const WEEK_MINUTES = DAY_MINUTES * 5;

export const isoDay = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const holidayName = (d) => HOLIDAYS[isoDay(d)] || "";
export const isHoliday = (d) => Object.prototype.hasOwnProperty.call(HOLIDAYS, isoDay(d));
export const isWorkday = (d) => {
  const wd = d.getDay();
  return wd >= 1 && wd <= 5 && !isHoliday(d);
};

// Last working day of that week — normally Friday, Thursday when Friday is off.
export function isLastWorkday(date) {
  if (!isWorkday(date)) return false;
  const probe = new Date(date);
  for (let wd = date.getDay() + 1; wd <= 5; wd += 1) {
    probe.setDate(probe.getDate() + 1);
    if (isWorkday(probe)) return false;
  }
  return true;
}

// The stretches of a day that count as working time.
export function segmentsOf(date) {
  if (!isWorkday(date)) return [];
  const shift = isLastWorkday(date) ? SHIFT.last : SHIFT.normal;
  let out = [[shift.start, shift.end]];
  [...BREAKS].sort((a, b) => a.start - b.start).forEach((brk) => {
    const next = [];
    out.forEach((seg) => {
      if (brk.end <= seg[0] || brk.start >= seg[1]) { next.push(seg); return; }
      if (seg[0] < brk.start) next.push([seg[0], brk.start]);
      if (seg[1] > brk.end) next.push([brk.end, seg[1]]);
    });
    out = next;
  });
  return out.filter((seg) => seg[1] > seg[0]);
}

const atMinute = (d, m) => { const x = new Date(d); x.setHours(0, m, 0, 0); return x; };
const minuteOf = (d) => d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;

export function minutesOfDuration(duration) {
  const value = Number(duration?.value) || 0;
  if (duration?.unit === "h") return value * 60;
  if (duration?.unit === "w") return value * WEEK_MINUTES;
  return value * DAY_MINUTES;
}

// Nudge a moment forward until it sits inside working time.
export function intoWorkHours(from) {
  const x = new Date(from);
  for (let guard = 0; guard < 800; guard += 1) {
    const segs = segmentsOf(x);
    if (segs.length) {
      const m = minuteOf(x);
      for (const seg of segs) {
        if (m < seg[0]) return atMinute(x, seg[0]);
        if (m < seg[1]) return x;
      }
    }
    x.setDate(x.getDate() + 1);
    x.setHours(0, 0, 0, 0);
  }
  return x;
}

// Spend `mins` of working time starting from `from`.
export function addWorkMinutes(from, mins) {
  let x = intoWorkHours(from);
  let left = mins;
  if (left <= 0) return x;
  for (let guard = 0; guard < 2000 && left > 0; guard += 1) {
    const segs = segmentsOf(x);
    const m = minuteOf(x);
    let moved = false;
    for (const seg of segs) {
      if (m >= seg[1]) continue;
      const start = Math.max(m, seg[0]);
      const avail = seg[1] - start;
      if (left <= avail) return atMinute(x, start + left);
      left -= avail;
      x = atMinute(x, seg[1]);
      moved = true;
    }
    if (!moved || minuteOf(x) >= (segs.length ? segs[segs.length - 1][1] : 0)) {
      x.setDate(x.getDate() + 1);
      x.setHours(0, 0, 0, 0);
      x = intoWorkHours(x);
    }
  }
  return x;
}

// A paused playbook's targets slide forward by however long it has been held.
export function runAnchor(flow) {
  if (!flow?.startedAt) return Date.now();
  return flow.startedAt + (flow.pausedMs || 0) + (flow.pausedAt ? Date.now() - flow.pausedAt : 0);
}

// Steps run in order, so each one targets the moment the previous finishes.
export function scheduleItems(flow) {
  const map = {};
  let cursor = new Date(runAnchor(flow));
  (flow?.items || []).forEach((item) => {
    if (item.kind !== "step") return;
    const start = intoWorkHours(cursor);
    const end = addWorkMinutes(start, minutesOfDuration(item.duration));
    map[item.id] = { start, end };
    cursor = end;
  });
  return map;
}

export function upcomingHolidays(count = 3) {
  const today = isoDay(new Date());
  const out = [];
  let lastName = "";
  Object.keys(HOLIDAYS).sort().forEach((key) => {
    if (key < today) return;
    const name = HOLIDAYS[key];
    if (name === lastName && out.length) { out[out.length - 1].to = key; return; }
    if (out.length >= count) return;
    out.push({ from: key, to: "", name });
    lastName = name;
  });
  return out;
}
