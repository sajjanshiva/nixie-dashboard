/** @type {import('tailwindcss').Config} */
//
// ── THEME COLOR — change the whole dashboard's color in one place ──
// Every page uses `accent` / `accent-soft` / `accent-text` classes
// (bg-accent, text-accent, border-accent, bg-accent-soft, text-accent-text)
// instead of hardcoded colors. Swap ONE of the presets below (or write
// your own 3 hex codes) and the entire app re-themes — buttons, active
// nav item, progress bars, badges, everything.
//
// Presets (uncomment one, or replace the values directly):
//
// Indigo (default):  DEFAULT:"#4F46E5", soft:"#EEF2FF", text:"#3730A3"
// Blue:               DEFAULT:"#2563EB", soft:"#EFF6FF", text:"#1D4ED8"
// Black / monochrome: DEFAULT:"#18181B", soft:"#F4F4F5", text:"#18181B"
// Navy:                DEFAULT:"#1E3A8A", soft:"#EFF3FB", text:"#1E3A8A"
// Green:               DEFAULT:"#059669", soft:"#ECFDF5", text:"#047857"
//
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: "#4F46E5",
          soft: "#EEF2FF",
          text: "#3730A3",
        },
      },
    },
  },
  plugins: [],
};
