# Unified Wind Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current custom-location picker with a shared wind-map screen that owns `Auto / Custom` location mode and renders a cached, zoom-adaptive 20 m wind overlay with sparse direction arrows.

**Architecture:** Keep the existing point-forecast pipeline intact for the main heatmap, and add a separate map-overlay pipeline for viewport sampling, caching, and rendering. The UI refactor introduces a new `WindMap` screen used both for browsing from the main screen and for explicit custom-location selection, while settings lose their location-management controls.

**Tech Stack:** Svelte 5, TypeScript, MapLibre GL, Vitest, Playwright

---

## Files touched

| File | Change |
|------|--------|
| `src/lib/types.ts` | extend shared types for active map state and overlay samples |
| `src/lib/stores/settingsStore.ts` | keep persisted location mode/custom location, add pure helpers if needed |
| `src/lib/stores/windStore.ts` | expose current active forecast coordinates in a reusable way |
| `src/lib/services/openMeteo.ts` | add overlay-specific fetch/decode helpers for wind direction and 20 m interpolation inputs |
| `src/lib/services/forecastCache.ts` | add or share resilient storage helpers for overlay cache |
| `src/lib/services/mapOverlay.ts` | new viewport-sampling and cache orchestration service |
| `src/lib/services/mapOverlayMath.ts` | new pure helpers for zoom tiers, grid generation, interpolation, arrow thinning |
| `src/lib/stores/mapOverlayStore.ts` | new Svelte store for map overlay state and loading |
| `src/lib/components/WindMap.svelte` | new shared full-screen map screen |
| `src/lib/components/MapOverlayCanvas.svelte` | new translucent speed wash + arrow renderer |
| `src/lib/components/AppHeader.svelte` | add `Map` entry point |
| `src/lib/components/SettingsSheet.svelte` | remove location-mode/custom-location controls |
| `src/App.svelte` | replace `LocationPicker` flow with `WindMap` screen and update location handling |
| `src/tests/openMeteo.test.ts` | add decoding/interpolation coverage for overlay fields |
| `src/tests/settingsStore.test.ts` | add location helper/state tests if pure helpers move there |
| `src/tests/mobileLayout.test.ts` | replace picker-specific layout assertions with wind-map assertions |
| `src/tests/mapOverlayMath.test.ts` | new unit tests for zoom tiers, viewport sampling, arrow thinning |
| `src/tests/mapOverlayStore.test.ts` | new unit tests for auto/custom behavior and cache-first loading |
| `e2e/location-mode-refetch.spec.ts` | rewrite around the new map-driven location flow |

---

## Task 1: Define map overlay types and pure math

**Files:**
- Modify: `src/lib/types.ts`
- Create: `src/lib/services/mapOverlayMath.ts`
- Create: `src/tests/mapOverlayMath.test.ts`

- [ ] **Step 1: Add shared overlay types**

In `src/lib/types.ts`, add the new types needed by the map overlay pipeline:

```ts
export interface ForecastLocation {
  lat: number;
  lon: number;
  name: string;
}

export interface OverlaySample {
  lat: number;
  lon: number;
  speedKmh: number;
  directionDeg: number;
  fetchedAt: number;
}

export type OverlayDensity = 'coarse' | 'medium' | 'fine';
```

- [ ] **Step 2: Write failing math tests**

Create `src/tests/mapOverlayMath.test.ts` with focused pure tests:

```ts
import { describe, expect, it } from 'vitest';
import { densityForZoom, buildViewportGrid, thinArrows } from '../lib/services/mapOverlayMath';

describe('densityForZoom', () => {
  it('returns coarse for low zoom', () => expect(densityForZoom(5)).toBe('coarse'));
  it('returns fine for high zoom', () => expect(densityForZoom(11)).toBe('fine'));
});

describe('buildViewportGrid', () => {
  it('caps sample count for a large viewport', () => {
    const points = buildViewportGrid({ north: 54, south: 49, east: 24, west: 14 }, 'coarse');
    expect(points.length).toBeLessThanOrEqual(64);
  });
});
```

- [ ] **Step 3: Run tests to verify failure**

Run: `npm test -- --run src/tests/mapOverlayMath.test.ts`

Expected: FAIL with module-not-found or missing export errors.

- [ ] **Step 4: Implement minimal pure helpers**

Create `src/lib/services/mapOverlayMath.ts`:

```ts
import type { OverlayDensity } from '../types';

export function densityForZoom(zoom: number): OverlayDensity {
  if (zoom >= 10) return 'fine';
  if (zoom >= 7) return 'medium';
  return 'coarse';
}
```

Also implement:
- viewport-grid generation from bounds + density
- hard point cap
- coordinate rounding for cache keys
- arrow thinning that keeps only every Nth sample by density

- [ ] **Step 5: Run tests to verify pass**

Run: `npm test -- --run src/tests/mapOverlayMath.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/types.ts src/lib/services/mapOverlayMath.ts src/tests/mapOverlayMath.test.ts
git commit -m "feat: add pure wind-map overlay math helpers"
```

---

## Task 2: Add overlay fetch/decode and cache primitives

**Files:**
- Modify: `src/lib/services/openMeteo.ts`
- Modify: `src/lib/services/forecastCache.ts`
- Modify: `src/tests/openMeteo.test.ts`

- [ ] **Step 1: Write failing decode tests**

Extend `src/tests/openMeteo.test.ts`:

```ts
it('decodes overlay wind direction fields', () => {
  const decoded = decodeOverlayResponse({
    hourly: {
      time: ['2026-04-05T14:00'],
      wind_speed_10m: [12],
      wind_speed_80m: [20],
      wind_direction_10m: [180],
      wind_direction_80m: [210]
    }
  });

  expect(decoded.directionAt10m[0]).toBe(180);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- --run src/tests/openMeteo.test.ts`

Expected: FAIL because overlay helpers do not exist.

- [ ] **Step 3: Extend Open-Meteo helpers**

In `src/lib/services/openMeteo.ts`:
- add an overlay URL builder that requests direction fields alongside wind speed
- add `decodeOverlayResponse(...)`
- add a pure interpolation helper for `20 m` speed and direction inputs

Minimal shape:

```ts
export interface OverlayHourData {
  times: Date[];
  speedAt10m: number[];
  speedAt80m: number[];
  directionAt10m: number[];
  directionAt80m: number[];
}
```

- [ ] **Step 4: Add resilient cache helpers**

In `src/lib/services/forecastCache.ts`, add overlay-specific read/write helpers that mirror current `try/catch` behavior:

```ts
export function readOverlaySample(key: string): OverlaySample | null { /* ... */ }
export function writeOverlaySample(key: string, sample: OverlaySample): void { /* ... */ }
```

- [ ] **Step 5: Run focused tests**

Run: `npm test -- --run src/tests/openMeteo.test.ts src/tests/forecastCache.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/services/openMeteo.ts src/lib/services/forecastCache.ts src/tests/openMeteo.test.ts
git commit -m "feat: add overlay weather fetch and cache primitives"
```

---

## Task 3: Build overlay service and store

**Files:**
- Create: `src/lib/services/mapOverlay.ts`
- Create: `src/lib/stores/mapOverlayStore.ts`
- Create: `src/tests/mapOverlayStore.test.ts`

- [ ] **Step 1: Write failing store tests**

Create `src/tests/mapOverlayStore.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createMapOverlayController } from '../lib/stores/mapOverlayStore';

describe('map overlay auto/custom behavior', () => {
  it('does not mutate active location when browsing in auto mode', async () => {
    const controller = createMapOverlayController(/* mocked deps */);
    await controller.setMode('auto');
    await controller.onMapMove({ lat: 50.1, lon: 19.9 });
    expect(controller.getState().activeLocation.name).toBe('GPS spot');
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- --run src/tests/mapOverlayStore.test.ts`

Expected: FAIL because the store/controller does not exist.

- [ ] **Step 3: Implement overlay service**

Create `src/lib/services/mapOverlay.ts` with one responsibility: fetch/cache samples for a viewport/hour combination.

Core API:

```ts
export async function loadViewportOverlay(args: {
  bounds: { north: number; south: number; east: number; west: number };
  zoom: number;
  hourIndex: number;
}): Promise<OverlaySample[]>
```

Rules:
- derive density from zoom
- build viewport grid
- read cache first
- fetch only missing samples
- return partial results if some samples fail

- [ ] **Step 4: Implement state controller/store**

Create `src/lib/stores/mapOverlayStore.ts` with:
- `mode`
- `activeLocation`
- `mapCenter`
- `pendingCustomLocation`
- `selectedHour`
- `overlayState`

Include explicit actions:
- `openAtLocation(...)`
- `setMode(...)`
- `setMapCenter(...)`
- `confirmCustomLocation()`
- `loadOverlayForViewport(...)`

- [ ] **Step 5: Run tests**

Run: `npm test -- --run src/tests/mapOverlayStore.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/services/mapOverlay.ts src/lib/stores/mapOverlayStore.ts src/tests/mapOverlayStore.test.ts
git commit -m "feat: add wind-map overlay service and state store"
```

---

## Task 4: Render the overlay on top of MapLibre

**Files:**
- Create: `src/lib/components/MapOverlayCanvas.svelte`
- Modify: `src/tests/mobileLayout.test.ts`

- [ ] **Step 1: Write failing rendering/layout tests**

Extend `src/tests/mobileLayout.test.ts` with assertions for the new component CSS:

```ts
it('keeps the wind map controls away from iPhone safe areas', () => {
  const css = compiledCss('/Users/szymonkocot/Projects/fpv-blast/src/lib/components/MapOverlayCanvas.svelte');
  expect(css).toMatch(/pointer-events:\s*none/);
});
```

Also add a test for `WindMap.svelte` later in Task 5 for top/bottom safe-area padding.

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- --run src/tests/mobileLayout.test.ts`

Expected: FAIL because the component does not exist yet.

- [ ] **Step 3: Implement the canvas overlay**

Create `src/lib/components/MapOverlayCanvas.svelte` that:
- accepts overlay samples, bounds, threshold, and density
- draws a translucent speed wash
- draws sparse direction arrows
- keeps `pointer-events: none`

Minimal prop shape:

```ts
export let samples: OverlaySample[] = [];
export let thresholdKmh: number;
export let density: OverlayDensity;
```

- [ ] **Step 4: Re-run layout tests**

Run: `npm test -- --run src/tests/mobileLayout.test.ts`

Expected: PASS for the new overlay assertions.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/MapOverlayCanvas.svelte src/tests/mobileLayout.test.ts
git commit -m "feat: render translucent wind-map overlay and arrows"
```

---

## Task 5: Replace LocationPicker with the unified WindMap screen

**Files:**
- Create: `src/lib/components/WindMap.svelte`
- Modify: `src/App.svelte`
- Modify: `src/lib/components/AppHeader.svelte`
- Delete or stop using: `src/lib/components/LocationPicker.svelte`

- [ ] **Step 1: Write failing integration-safe CSS assertions**

Add to `src/tests/mobileLayout.test.ts`:

```ts
it('pads the wind map chrome away from the notch and home indicator', () => {
  const css = compiledCss('/Users/szymonkocot/Projects/fpv-blast/src/lib/components/WindMap.svelte');
  expect(css).toMatch(/padding:\s*calc\(10px \+ var\(--safe-top\)\)/);
  expect(css).toMatch(/calc\(12px \+ var\(--safe-bottom\)\)/);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- --run src/tests/mobileLayout.test.ts`

Expected: FAIL because `WindMap.svelte` does not exist yet.

- [ ] **Step 3: Implement `WindMap.svelte`**

The component should include:
- back action
- search input
- `Auto / Custom` toggle
- hour controls (`Now`, nearby forecast hours, or selected-hour label)
- MapLibre instance
- `MapOverlayCanvas`
- bottom sheet with mode-aware actions

- [ ] **Step 4: Integrate screen into `App.svelte`**

In `src/App.svelte`:
- replace `showLocationPicker` with `showWindMap`
- open `WindMap` from a new `Map` action in the header
- remove auto-open custom picker behavior
- keep existing forecast fetching logic, but route explicit custom confirmation through the new screen

- [ ] **Step 5: Add the map entry point**

In `src/lib/components/AppHeader.svelte`, add a `Map` button or action target that can open the shared wind map from the main screen.

- [ ] **Step 6: Run tests**

Run: `npm test -- --run src/tests/mobileLayout.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/components/WindMap.svelte src/App.svelte src/lib/components/AppHeader.svelte src/tests/mobileLayout.test.ts
git commit -m "feat: replace location picker with unified wind map screen"
```

---

## Task 6: Remove location controls from settings and wire explicit commits

**Files:**
- Modify: `src/lib/components/SettingsSheet.svelte`
- Modify: `src/lib/stores/settingsStore.ts`
- Modify: `src/tests/settingsStore.test.ts`

- [ ] **Step 1: Write failing tests or assertions for removed settings UI**

If you keep source-level UI regression tests, add a simple assertion that the settings sheet no longer references `locationModes` or `onOpenPicker`.

```ts
import { readFileSync } from 'node:fs';
it('does not manage location mode inside settings', () => {
  const source = readFileSync('/Users/szymonkocot/Projects/fpv-blast/src/lib/components/SettingsSheet.svelte', 'utf8');
  expect(source).not.toContain('locationModes');
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- --run src/tests/settingsStore.test.ts src/tests/mobileLayout.test.ts`

Expected: FAIL until settings UI and related wiring are cleaned up.

- [ ] **Step 3: Remove settings-based location management**

In `src/lib/components/SettingsSheet.svelte`:
- remove `Auto / Custom` controls
- remove custom location row
- remove `onOpenPicker`

In `src/App.svelte`:
- remove now-obsolete settings-to-picker wiring

- [ ] **Step 4: Keep persisted state, but simplify ownership**

In `src/lib/stores/settingsStore.ts`, keep `locationMode` and `customLocation` as persisted state because the map screen still needs them, but remove any helpers that only existed for the old picker flow.

- [ ] **Step 5: Run tests**

Run: `npm test -- --run src/tests/settingsStore.test.ts src/tests/mobileLayout.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/SettingsSheet.svelte src/lib/stores/settingsStore.ts src/tests/settingsStore.test.ts src/tests/mobileLayout.test.ts src/App.svelte
git commit -m "refactor: move location mode controls from settings to wind map"
```

---

## Task 7: Rewrite end-to-end flow around the new map behavior

**Files:**
- Modify: `e2e/location-mode-refetch.spec.ts`

- [ ] **Step 1: Rewrite the failing e2e scenario**

Replace the old settings-based scenario with:

1. app starts in `Auto`
2. open `WindMap`
3. pan in `Auto`
4. assert active forecast location does not change
5. switch to `Custom`
6. confirm `Use this spot`
7. assert a new forecast fetch occurs
8. switch back to `Auto`
9. assert a GPS-based fetch occurs

- [ ] **Step 2: Run the e2e test to verify failure**

Run: `npx playwright test e2e/location-mode-refetch.spec.ts`

Expected: FAIL until the new map flow is fully wired.

- [ ] **Step 3: Fix selectors and waits only after the UI exists**

Use explicit roles/text from the final UI:

```ts
await page.getByRole('button', { name: /map/i }).click();
await page.getByRole('button', { name: /custom/i }).click();
await page.getByRole('button', { name: /use this spot/i }).click();
```

- [ ] **Step 4: Re-run the e2e test**

Run: `npx playwright test e2e/location-mode-refetch.spec.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add e2e/location-mode-refetch.spec.ts
git commit -m "test: cover unified wind map auto and custom flows"
```

---

## Task 8: Final verification

**Files:**
- Modify: any files touched above as needed

- [ ] **Step 1: Run full unit test suite**

Run: `npm test`

Expected: PASS.

- [ ] **Step 2: Run type checks**

Run: `npm run check`

Expected: PASS.

- [ ] **Step 3: Run the focused e2e flow**

Run: `npx playwright test e2e/location-mode-refetch.spec.ts`

Expected: PASS.

- [ ] **Step 4: Build production bundle**

Run: `npm run build`

Expected: PASS and `dist/` generated.

- [ ] **Step 5: Commit final cleanup**

```bash
git add src App.svelte docs/superpowers/plans/2026-04-05-unified-wind-map.md e2e/location-mode-refetch.spec.ts
git commit -m "feat: add unified wind map with cached 20m overlay"
```

---

## Notes for implementation

- Keep the current heatmap forecast path untouched unless a step explicitly needs shared location state extracted.
- Prefer pure helper extraction for anything involving zoom tiers, cache keys, viewport grids, and interpolation.
- Do not let `Auto` mode browsing mutate the active forecast location.
- Do not implicitly commit custom locations on pan; only the explicit confirmation action may do that.
- If the overlay becomes too noisy, reduce arrow density first before changing the color wash.
