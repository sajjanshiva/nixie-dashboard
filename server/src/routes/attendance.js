import { Router } from "express";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import { haversineMeters } from "../lib/haversine.js";

const router = Router();

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

// POST /api/attendance/check-in
// Body: { lat, lng }
// GPS + office-geofence + on-time/late validation all happen here, on the
// server — never trust a distance/time calculated in the browser.
router.post("/check-in", async (req, res) => {
  const { lat, lng } = req.body;
  if (lat == null || lng == null) return res.status(400).json({ message: "lat and lng are required" });

  const officeLat = Number(process.env.OFFICE_LAT);
  const officeLng = Number(process.env.OFFICE_LNG);
  const radius = Number(process.env.OFFICE_RADIUS_METERS || 120);
  const distance = haversineMeters(lat, lng, officeLat, officeLng);

  if (distance > radius) {
    return res.status(403).json({ message: `You're ${Math.round(distance)}m from the office — check-in must be within ${radius}m.` });
  }

  const now = new Date();
  const [startH, startM] = (process.env.OFFICE_START_TIME || "09:30").split(":").map(Number);
  const officeStart = new Date(now);
  officeStart.setHours(startH, startM, 0, 0);
  const status = now <= officeStart ? "on_time" : "late";

  const { data, error } = await supabaseAdmin
    .from("attendance")
    .upsert(
      { staff_id: req.user.id, date: todayDate(), check_in: now.toISOString(), status },
      { onConflict: "staff_id,date" }
    )
    .select()
    .single();
  if (error) return res.status(500).json({ message: error.message });

  res.json({ checkIn: data.check_in, checkOut: data.check_out, statusToday: data.status });
});

// POST /api/attendance/check-out
router.post("/check-out", async (req, res) => {
  const { data: row } = await supabaseAdmin
    .from("attendance")
    .select("*")
    .eq("staff_id", req.user.id)
    .eq("date", todayDate())
    .single();
  if (!row) return res.status(400).json({ message: "You haven't checked in today" });

  const { data, error } = await supabaseAdmin
    .from("attendance")
    .update({ check_out: new Date().toISOString() })
    .eq("id", row.id)
    .select()
    .single();
  if (error) return res.status(500).json({ message: error.message });

  res.json({ checkIn: data.check_in, checkOut: data.check_out, statusToday: data.status });
});

export default router;
