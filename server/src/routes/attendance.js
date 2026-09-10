import { Router } from "express";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import { haversineMeters } from "../lib/haversine.js";
import { getSetting } from "../lib/settings.js";
import { istDateStr, istDateTimeAt } from "../lib/istDate.js";

const router = Router();

function todayDate() {
  return istDateStr();
}

// Builds a real Date object for "office end time" on a given date string,
// e.g. dateStr="2026-09-04", officeEndTime="17:00" -> Date at 5PM that
// day, IN INDIA TIME — correct regardless of the server's own timezone.
function dateTimeAt(dateStr, hhmm) {
  return istDateTimeAt(dateStr, hhmm);
}

// Closes any session left open (check_in but no check_out) from a
// PREVIOUS day — staff forgot to check out. Closes it at that day's
// office end time, flags it auto_closed, and does NOT credit overtime
// (we don't know when they actually left, so we don't guess).
//
// Exported so admin's Performance endpoint can trigger this too — not
// just the staff member's own check-in/check-out/sync — so admin isn't
// stuck waiting for that staff member to open the app again before a
// forgotten checkout gets flagged and visible.
export async function closeStaleSessions(staffId) {
  const today = todayDate();
  const { data: openRows, error: selectError } = await supabaseAdmin
    .from("attendance")
    .select("*")
    .eq("staff_id", staffId)
    .is("check_out", null)
    .lt("date", today);

  if (selectError) {
    console.error("[closeStaleSessions] failed to load open sessions:", selectError.message);
    return;
  }
  if (!openRows?.length) return;

  const officeEndTime = (await getSetting("office_end_time")) || "17:00";
  for (const row of openRows) {
    const closeAt = dateTimeAt(row.date, officeEndTime);
    // Note: the Supabase client resolves with { error }, it does NOT
    // reject/throw — a trailing .catch() here would never actually run,
    // silently hiding real failures. Check the returned error instead.
    const { error: updateError } = await supabaseAdmin
      .from("attendance")
      .update({ check_out: closeAt.toISOString(), auto_closed: true, overtime_minutes: 0 })
      .eq("id", row.id);
    if (updateError) {
      console.error(`[closeStaleSessions] failed to close session ${row.id}:`, updateError.message);
    }
  }
}

// POST /api/attendance/sync
// Called by the client on Home page load, before reading today/week
// attendance — makes sure any forgotten-checkout session from a
// previous day is cleaned up first.
router.post("/sync", async (req, res) => {
  await closeStaleSessions(req.user.id);
  res.json({ ok: true });
});

// POST /api/attendance/check-in
// Body: { lat, lng, workMode: 'office' | 'home' }
router.post("/check-in", async (req, res) => {
  const { lat, lng, workMode } = req.body;
  if (workMode !== "office" && workMode !== "home") {
    return res.status(400).json({ message: "workMode must be 'office' or 'home'" });
  }
  if (workMode === "office" && (lat == null || lng == null)) {
    return res.status(400).json({ message: "lat and lng are required for office check-in" });
  }

  await closeStaleSessions(req.user.id);

  const today = todayDate();
  const officeStartTime = (await getSetting("office_start_time")) || "09:30";
  const officeEndTime = (await getSetting("office_end_time")) || "17:00";

  // Holiday check — no check-ins on a marked holiday.
  try {
    const { data: holiday } = await supabaseAdmin
      .from("holidays")
      .select("name")
      .eq("date", today)
      .maybeSingle();
    if (holiday) {
      return res.status(403).json({ message: `Today is a holiday (${holiday.name}) — check-in is disabled.` });
    }
  } catch (err) {
    console.warn("[check-in holiday check] error:", err.message);
  }

  // Already have an open session today? Don't allow a second one on top.
  const { data: todaysRows } = await supabaseAdmin
    .from("attendance")
    .select("*")
    .eq("staff_id", req.user.id)
    .eq("date", today)
    .order("check_in", { ascending: true });

  const openSession = (todaysRows || []).find((r) => !r.check_out);
  if (openSession) {
    return res.status(400).json({ message: "You're already checked in — check out first." });
  }

  // Locked for the day? (already checked out at/after office end time today)
  const officeEndToday = dateTimeAt(today, officeEndTime);
  const dayEnded = (todaysRows || []).some((r) => r.check_out && new Date(r.check_out) >= officeEndToday);
  if (dayEnded) {
    return res.status(403).json({ message: "You've already checked out for today. Check in again tomorrow from 9 AM." });
  }

  // Office geofence check.
  if (workMode === "office") {
    const officeLocation = await getSetting("office_location");
    const distance = haversineMeters(lat, lng, officeLocation.lat, officeLocation.lng);
    if (distance > officeLocation.radius_meters) {
      return res.status(403).json({
        message: `You're ${Math.round(distance)}m from the office — check-in must be within ${officeLocation.radius_meters}m.`,
      });
    }
  }

  const now = new Date();
  const officeStartToday = dateTimeAt(today, officeStartTime);
  // Only the FIRST session of the day carries an on-time/late status —
  // later sessions that day (e.g. back from lunch) don't re-evaluate it.
  const isFirstSessionToday = !(todaysRows || []).length;
  const status = isFirstSessionToday ? (now <= officeStartToday ? "on_time" : "late") : null;

  const { data, error } = await supabaseAdmin
    .from("attendance")
    .insert({
      staff_id: req.user.id,
      date: today,
      check_in: now.toISOString(),
      work_mode: workMode,
      status,
    })
    .select()
    .single();
  if (error) return res.status(500).json({ message: error.message });

  res.json(data);
});

// POST /api/attendance/check-out
router.post("/check-out", async (req, res) => {
  // Sweep for any OTHER forgotten-checkout sessions from earlier days too
  // — not just today's. Previously this only ran on check-in/sync, so a
  // stale session could sit unflagged if the staff member's next action
  // was a check-out rather than a fresh check-in.
  await closeStaleSessions(req.user.id);

  const today = todayDate();
  const { data: row } = await supabaseAdmin
    .from("attendance")
    .select("*")
    .eq("staff_id", req.user.id)
    .eq("date", today)
    .is("check_out", null)
    .order("check_in", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!row) return res.status(400).json({ message: "You haven't checked in today" });

  const now = new Date();
  const officeEndTime = await getSetting("office_end_time");
  const officeEndToday = dateTimeAt(today, officeEndTime);

  // Overtime = only the portion of THIS session that falls after office
  // end time (handles a session that starts before 5PM and ends after).
  const overtimeStart = new Date(Math.max(new Date(row.check_in).getTime(), officeEndToday.getTime()));
  const overtimeMinutes = now > overtimeStart ? Math.round((now - overtimeStart) / 60000) : 0;

  const { data, error } = await supabaseAdmin
    .from("attendance")
    .update({ check_out: now.toISOString(), overtime_minutes: overtimeMinutes })
    .eq("id", row.id)
    .select()
    .single();
  if (error) return res.status(500).json({ message: error.message });

  res.json(data);
});

// GET /api/attendance/detail?staffId=...&from=YYYY-MM-DD&to=YYYY-MM-DD
// Admin-only detailed session log for one staff member over a range —
// used by the Attendance/Performance admin views.
router.get("/detail", async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ message: "Admin only" });

  const { staffId, from, to } = req.query;
  if (!staffId || !from || !to) return res.status(400).json({ message: "staffId, from, to are required" });

  const { data, error } = await supabaseAdmin
    .from("attendance")
    .select("*")
    .eq("staff_id", staffId)
    .gte("date", from)
    .lte("date", to)
    .order("date", { ascending: true })
    .order("check_in", { ascending: true });
  if (error) return res.status(500).json({ message: error.message });

  res.json(data);
});

// PUT /api/attendance/:id — admin-only correction (e.g. fixing an
// auto-closed session with the real checkout time the staff reports).
router.put("/:id", async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ message: "Admin only" });

  const { checkOut } = req.body || {};
  if (!checkOut) return res.status(400).json({ message: "checkOut is required" });

  const { data: row, error: fetchErr } = await supabaseAdmin
    .from("attendance")
    .select("*")
    .eq("id", req.params.id)
    .single();
  if (fetchErr || !row) return res.status(404).json({ message: "Session not found" });

  const officeEndTime = await getSetting("office_end_time");
  const officeEndThatDay = dateTimeAt(row.date, officeEndTime);
  const checkOutDate = new Date(checkOut);
  const overtimeStart = new Date(Math.max(new Date(row.check_in).getTime(), officeEndThatDay.getTime()));
  const overtimeMinutes = checkOutDate > overtimeStart ? Math.round((checkOutDate - overtimeStart) / 60000) : 0;

  const { data, error } = await supabaseAdmin
    .from("attendance")
    .update({ check_out: checkOutDate.toISOString(), auto_closed: false, overtime_minutes: overtimeMinutes })
    .eq("id", req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ message: error.message });

  res.json(data);
});

export default router;