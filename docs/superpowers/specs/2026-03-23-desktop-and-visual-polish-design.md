# Desktop Layout & Visual Polish — Design Specification

**Date:** 2026-03-23
**Scope:** Responsive desktop layout, heatmap visual improvements, coloured slider track

---

## Overview

Three coordinated changes to FPV Blast:

1. **Desktop layout** — remove the 480 px width cap so the app fills the browser on desktop/laptop screens.
2. **Heatmap rendering** — replace solid rectangles with rounded, gapless cells rendered with a 2-D bilinear gradient (smooth blending across both height and time axes).
3. **Time-slider colour track** — replace the plain grey track with a canvas-rendered gradient strip whose colour at each position reflects the average wind speed across all 18 heights for that hour.

The app remains a single-screen layout on all screen sizes; no routing or structural changes.

---

## 1. Desktop Layout (`app.css`, `App.svelte`)

### Change

Remove `max-width: 480px` from `#app` in `app.css`. The app shell already uses `display: flex; flex-direction: column; height: 100%` — without the cap it will fill the viewport on any width.

### Responsive font and spacing scaling

Add a `@media (min-width: 768px)` block in `app.css` that increases axis label sizes and the settings icon size for desktop. No layout restructuring — same vertical stack, just proportionally larger text/icons.

| Element | Mobile | Desktop (≥ 768 px) |
|---|---|---|
| Y / X axis labels (canvas) | 10 px | 13 px |
| Slider hint / tick text | 9–10 px | 12–13 px |
| Settings ⚙ icon | 18 px | 26 px |
| Heatmap canvas label area (`LABEL_W`) | 36 px | 50 px |

The canvas-drawn labels (`HeatmapCanvas.svelte`) must read a CSS custom property or use `window.innerWidth` to pick the correct font size at draw time.

---

## 2. Heatmap Visual Polish (`HeatmapCanvas.svelte`)

### Cell rendering

Replace the current `ctx.fillRect(x, y, cellW - 0.5, cellH - 0.5)` with rounded, gapless cells drawn via `ctx.roundRect`.

**Parameters:**
- Gap between cells: `2 px`
- Corner radius: `4 px`
- Cell size: `(chartW - gap × (cols−1)) / cols` × `(chartH - gap × (rows−1)) / rows`

### 2-D bilinear gradient per cell

Each cell blends colour from four corners (current hour × current height, next hour × current height, current hour × next height, next hour × next height).

Implemented as two overlaid canvas gradients per cell inside a `roundRect` clip:

1. **Vertical pass** — `createLinearGradient(0, y, 0, y+cellH)` from the height-averaged top colour to the height-averaged bottom colour.
2. **Horizontal overlay** — `createLinearGradient(x, 0, x+cellW, 0)` at `opacity ≈ 0.35`, blending left-edge to right-edge colours.

No explicit grid lines are drawn. The `2 px` gaps between cells provide visual separation.

### Canvas label font size

At draw time, choose font size based on canvas width:
```typescript
const fontSize = canvas.width > 600 ? 13 : 10;
const labelW   = canvas.width > 600 ? 50 : 36;
```

---

## 3. Coloured Slider Track (`TimeSlider.svelte`)

### Approach

Replace the CSS `::before` track with a `<canvas>` element absolutely positioned inside the existing `.track` div. The canvas is drawn once on mount and redrawn only when `thresholdKmh` changes (passed as a new prop).

### What is drawn

A single horizontal `createLinearGradient` with 168 colour stops (one per forecast hour). Each stop's colour is the average `windColor` across all 18 display heights at that hour.

```
stop position = hourIndex / 167
stop colour   = average windColor(speed[hourIndex][0..17], thresholdKmh)
```

Average colour: arithmetic mean of the R, G, B, A components across all 18 heights.

### New prop

`TimeSlider` receives a new prop:
```typescript
export let grid: WindGrid;          // already exists — used for times
export let thresholdKmh: number;    // NEW — triggers redraw when changed
```

`App.svelte` passes `thresholdKmh={$settingsStore.thresholdKmh}` to `TimeSlider`.

### Window highlight

A `<div class="window-highlight">` (white border box, no fill) is absolutely positioned over the canvas to show the current 24 h window. Width = `24/168 × 100%`, left = `hourOffset/168 × 100%`. This replaces the current filled blue track.

### Thumb

Unchanged — white circle, blue border, absolute position over the track.

---

## Files Changed

| File | Change |
|---|---|
| `src/app.css` | Remove `max-width: 480px`; add `@media (min-width: 768px)` scaling block |
| `src/lib/components/HeatmapCanvas.svelte` | Rounded cells, bilinear gradient, responsive font size |
| `src/lib/components/TimeSlider.svelte` | Canvas gradient track, new `thresholdKmh` prop, window-highlight div |
| `src/App.svelte` | Pass `thresholdKmh` to `TimeSlider` |

No new files. No changes to stores, services, or tests.

---

## Testing

No new unit tests required (canvas rendering is visual). Existing 39 tests must continue to pass. Manual verification:

- Desktop (≥ 768 px): app fills full width, labels readable, ⚙ icon clearly tappable.
- Mobile (< 768 px): layout and label sizes unchanged from current.
- Heatmap: rounded cells visible, no grid lines, colour blends smoothly across both axes.
- Slider: track shows wind colour gradient across 7 days; dragging thumb updates the window-highlight box and heatmap.
- Threshold change in settings: slider track redraws with new colour boundaries.
