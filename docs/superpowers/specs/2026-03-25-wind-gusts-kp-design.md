# Wind Gusts Row + Kp Index — Design Spec

**Date:** 2026-03-25
**Status:** Approved

---

## Goal

Extend the `WeatherStrip` with two new pieces of flight-relevant information:

1. **Wind gusts row** — a second scrollable row below the existing temperature row, showing `wind_gusts_10m` per hour, colour-coded by the user's wind threshold.
2. **Kp index badge** — a small badge in the strip header showing the current geomagnetic activity level. Tapping it expands a 3-day bar-chart forecast sourced from NOAA.

The heatmap remains unchanged.

---

## Decisions

| Question | Decision |
|---|---|
| Where do gusts live? | Second row in WeatherStrip (always visible) |
| Where does Kp live? | Badge in strip header; expands to bar chart panel |
| Gusts colour scale | User's `thresholdKmh` (green < 80 %, yellow 80–100 %, red ≥ 100 %) |
| Kp colour scale | Fixed: green 0–3, yellow 4–5, red 6–9 |
| Kp fetch timing | Eager — on app load alongside wind data |
| Kp API | NOAA SWPC planetary-k-index-forecast (free, no key, CORS-enabled) |

---

## Architecture

### 1. `src/lib/types.ts`

Add `windGust` to `WindGrid`:

```ts
export interface WindGrid {
  data: number[][];
  times: Date[];
  modelCount: number;
  temperature: number[];
  weatherCode: number[];
  windGust: number[];   // NEW — 168 entries, km/h at 10m
}
```

Add Kp types:

```ts
export interface KpEntry {
  time: Date;
  kp: number;
}

export type KpData = KpEntry[];
```

---

### 2. `src/lib/services/openMeteo.ts`

Extend the `hourly` param:

```ts
hourly: 'wind_speed_10m,wind_speed_80m,wind_speed_120m,wind_speed_180m,temperature_2m,weather_code,wind_gusts_10m',
```

In `decodeResponse`, add:

```ts
windGust: h.wind_gusts_10m as number[],
```

---

### 3. `src/lib/services/windProcessor.ts`

Extend `ModelData`:

```ts
export interface ModelData {
  at10m:       number[];
  at80m:       number[];
  at120m:      number[];
  at180m:      number[];
  temperature: number[];
  weatherCode: number[];
  windGust:    number[];   // NEW
}
```

In `buildGrid`, aggregate gusts the same way as wind speeds:

```ts
const windGust: number[] = [];
// inside the per-hour loop:
windGust.push(mean(removeOutliers(models.map(m => m.windGust[t] ?? 0))));
// in the return:
return { data, times, modelCount: models.length, temperature, weatherCode, windGust };
```

---

### 4. `src/lib/services/kpService.ts` — new file

Fetches and parses the NOAA planetary Kp index forecast.

```ts
import type { KpEntry } from '../types';

const NOAA_URL = 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json';

export async function fetchKpForecast(): Promise<KpEntry[]> {
  const res = await fetch(NOAA_URL);
  if (!res.ok) throw new Error(`Kp fetch failed: HTTP ${res.status}`);
  const rows: string[][] = await res.json();
  // First row is a header — skip it
  return rows.slice(1).map(([timeTag, kp]) => ({
    time: new Date(timeTag.replace(' ', 'T') + 'Z'),
    kp:   parseFloat(kp),
  })).filter(e => !isNaN(e.kp));
}
```

---

### 5. `src/lib/stores/kpStore.ts` — new file

```ts
import { writable } from 'svelte/store';
import type { KpData } from '../types';
import { fetchKpForecast } from '../services/kpService';

export const kpStore = writable<KpData | null>(null);

export async function fetchKp(): Promise<void> {
  try {
    kpStore.set(await fetchKpForecast());
  } catch {
    kpStore.set(null);
  }
}
```

---

### 6. `src/lib/i18n/en.ts` and `pl.ts`

New strings:

| Key | English | Polish |
|---|---|---|
| `gustsAt10m` | `'Gusts @ 10m'` | `'Porywy @ 10m'` |
| `kpQuiet` | `'Quiet'` | `'Spokojnie'` |
| `kpActive` | `'Active'` | `'Aktywnie'` |
| `kpStorm` | `'Storm'` | `'Burza'` |
| `kpForecast` | `'Kp forecast — 3 days'` | `'Prognoza Kp — 3 dni'` |

---

### 7. `src/lib/components/WeatherStrip.svelte`

New props:

```ts
export let windGust: number[];
export let thresholdKmh: number;
export let kpData: KpData | null;
```

New internal state:

```ts
let showKpPanel = false;
```

Kp badge label helper:

```ts
function kpLabel(kp: number): string {
  if (kp <= 3) return $t.kpQuiet;
  if (kp <= 5) return $t.kpActive;
  return $t.kpStorm;
}

function kpColor(kp: number): string {
  if (kp <= 3) return 'var(--green)';
  if (kp <= 5) return 'var(--yellow)';
  return 'var(--red)';
}
```

Gust colour helper (reuses existing `windColor` from `settingsStore`):

```ts
import { windColor } from '../stores/settingsStore';
```

Layout (top to bottom inside `.strip`):

1. **Header row** — "Weather" label + Kp badge
   - Badge text: `Kp {currentKp} — {kpLabel}` (or `Kp —` if `kpData` is null)
   - Chevron `▾` / `▴` on badge toggles `showKpPanel`
2. **Kp panel** (`{#if showKpPanel && kpData}`) — bar chart of all entries. The "current slot" is the `KpEntry` whose `time` is closest to `Date.now()` (i.e. `kpData.reduce` to find the minimum `|entry.time - now|`). Current slot highlighted in blue. Day separators between UTC midnight boundaries.
3. **Temp + weather icon cells** — unchanged
4. **Gusts label** — `$t.gustsAt10m`
5. **Gusts cells** — same 24-cell scrollable row using the same `indices` array as the temp row (driven by `hourOffset`). Value from `windGust[idx]`, background from `windColor(windGust[idx], thresholdKmh)`.

The two scrollable rows (`cells` and `gust-cells`) share scroll position — achieved by setting `overflow-x: auto` on the outer `.strip` container and making both rows children that share its scroll context (no nested scroll containers).

---

### 8. `src/App.svelte`

Import and call `fetchKp` on mount:

```ts
import { kpStore, fetchKp } from './lib/stores/kpStore';
// in onMount:
fetchKp();
```

Pass new props to `WeatherStrip`:

```svelte
<WeatherStrip
  grid={$windGrid}
  hourOffset={$hourOffset}
  unit={$settingsStore.tempUnit}
  windGust={$windGrid.windGust}
  thresholdKmh={$settingsStore.thresholdKmh}
  kpData={$kpStore}
/>
```

---

## Data flow

```
Open-Meteo (wind_gusts_10m)
  → decodeResponse → ModelData.windGust
  → buildGrid → mean(removeOutliers(...))
  → WindGrid.windGust
  → WeatherStrip gusts row (coloured by thresholdKmh)

NOAA SWPC planetary-k-index-forecast.json
  → fetchKpForecast() → KpEntry[]
  → kpStore
  → WeatherStrip badge (current Kp)
  → Kp panel bar chart (on expand)
```

---

## Error handling

| Scenario | Behaviour |
|---|---|
| NOAA fetch fails | `kpStore` stays `null`; badge shows `Kp —`; no expand |
| `wind_gusts_10m` null/undefined | `?? 0` guard in `buildGrid` — same pattern as wind speeds |
| Kp value out of range | Colour clamped (≥6 = red); bar height clamped to chart max |
| Empty NOAA response (0 entries after header) | Badge shows `Kp —`; no expand |

---

## Testing

### Fixture updates (TypeScript will fail without these)

**`windGrid.test.ts`** — `makeGrid` adds `windGust: Array(hours).fill(0)`

**`windProcessor.test.ts`** — `makeModelData` adds `windGust: Array(2).fill(0)`; all inline `ModelData` literals updated

**`openMeteo.test.ts`** — fixture adds `wind_gusts_10m: [15.0, 16.0]`; new assertions:
```ts
it('parses wind gusts', () => {
  expect(decodeResponse(json).windGust[0]).toBeCloseTo(15.0);
});
it('includes wind_gusts_10m in URL', () => {
  expect(buildUrl(0, 0, 'best_match')).toContain('wind_gusts_10m');
});
```

### New test file: `src/tests/kpService.test.ts`

| Case | Assertion |
|---|---|
| Header row skipped | `fetchKpForecast` result length = total rows − 1 |
| Time parsing | First entry `time` is a valid `Date` |
| Kp parsing | First entry `kp` is a finite number |
| Empty array input | Returns `[]` without throwing |
| Malformed row (NaN kp) | Entry filtered out |

---

## Out of scope

- Kp in SummaryStrip cards
- Gusts at heights other than 10m
- Kp refresh (fetched once per session — NOAA updates every 3 hours, close enough)
- Kp notifications or alerts
