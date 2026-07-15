// Shared chart palette for the analytics pages (Sales/AI Performance/
// Revenue Attribution) — the validated default categorical palette from
// this repo's dataviz skill, reused as-is rather than re-derived per page.
// Fixed slot order is the CVD-safety mechanism (never cycle/reassign), and
// any prefix of an already-validated set keeps the same worst-case adjacent
// contrast, so using the first N slots for a chart with fewer than 8
// series is safe without re-running the validator for every subset.
//
// Validated via scripts/validate_palette.js "#2a78d6,#1baf7a,#eda100"
// --mode light during the usage-metering phase (billing charts); the full
// 8-hue set is validated as documented in the skill's reference palette.

export const CATEGORICAL_PALETTE = [
  "#2a78d6", // 1 blue
  "#1baf7a", // 2 aqua
  "#eda100", // 3 yellow
  "#008300", // 4 green
  "#4a3aa7", // 5 violet
  "#e34948", // 6 red
  "#e87ba4", // 7 magenta
  "#eb6834", // 8 orange
]

// Fixed, never reused for a "series" — a status color always means a
// state, never an identity.
export const STATUS_GOOD = "#0ca30c"
export const STATUS_WARNING = "#fab219"
export const STATUS_CRITICAL = "#d03b3b"
export const STATUS_NEUTRAL = "#898781"

// Sequential single-hue ramp (blue) — for magnitude-over-time /
// magnitude-by-rank charts with one series (revenue trend, leaderboard
// bars), where color-by-rank isn't meaningful (color follows the entity,
// never its rank).
export const SEQUENTIAL_BLUE = "#2a78d6"

export function categoricalColor(index: number): string {
  return CATEGORICAL_PALETTE[index % CATEGORICAL_PALETTE.length]
}
