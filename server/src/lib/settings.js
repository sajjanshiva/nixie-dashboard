import { supabaseAdmin } from "./supabaseAdmin.js";

// Safe defaults for every setting key
const DEFAULTS = {
  office_start_time: "09:30",
  office_end_time: "17:00",
  office_location: { lat: 0, lng: 0, radius_meters: 120 },
  performance_weights: { punctuality: 0.4, task_on_time: 0.6 },
};

// Short in-memory cache so a burst of check-ins doesn't hammer the
// settings table with a read every time — settings change rarely.
const cache = new Map();
const TTL_MS = 30000;

export async function getSetting(key) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.time < TTL_MS) return cached.value;

  try {
    const { data, error } = await supabaseAdmin
      .from("settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();

    if (error || !data || data.value === undefined || data.value === null) {
      const fallback = DEFAULTS[key] ?? null;
      // Auto-heal by attempting to insert default if table exists
      if (fallback !== null) {
        supabaseAdmin.from("settings").upsert({ key, value: fallback }).catch(() => {});
      }
      return fallback;
    }

    cache.set(key, { value: data.value, time: Date.now() });
    return data.value;
  } catch (err) {
    console.warn(`[getSetting] Failed reading key "${key}", using default:`, err.message);
    return DEFAULTS[key] ?? null;
  }
}

export async function setSetting(key, value) {
  const { error } = await supabaseAdmin.from("settings").upsert({ key, value });
  if (error) throw error;
  cache.delete(key); // next read picks up the fresh value
}