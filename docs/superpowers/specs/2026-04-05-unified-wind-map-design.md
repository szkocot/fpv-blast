# Unified Wind Map Design

## Goal

Replace the current dedicated custom-location picker with a single shared full-screen wind map that:

- works as the app's map-browsing surface
- manages `Auto` vs `Custom` location mode
- shows a zoom-adaptive wind overlay for the visible viewport
- allows explicit confirmation of a custom spot

The first version only supports a `20 m` overlay and keeps all caching on-device.

## Agreed Product Behavior

### Shared screen

Introduce a new full-screen `WindMap` screen that is opened from the main UI and becomes the only map-based location-management surface. The current `LocationPicker` is removed from the settings flow.

### Location modes

The screen exposes an `Auto / Custom` mode switch.

#### Auto mode

- Initial center is GPS if available.
- If GPS fails, fall back to the current active location or the existing default fallback.
- The user may pan and inspect wind anywhere on the map.
- Panning in `Auto` does **not** change the app's active forecast location.
- The UI should clearly communicate that browsing is temporary unless the user switches to `Custom`.

#### Custom mode

- Initial center is the saved custom location when one exists.
- The user may search or pan freely.
- The map center represents a candidate location only.
- The user must tap an explicit action such as `Use this spot` to commit the custom location.
- No implicit location changes on pan.

### Main-screen integration

The main UI gets a `Map` entry point. Opening the map respects the active mode:

- `Auto` -> center on GPS/current automatic location
- `Custom` -> center on the saved custom location

This is the same screen in both cases, not separate picker and viewer screens.

## Wind Overlay

### Version 1 scope

- Wind speed overlay only for `20 m`
- Direction arrows shown on top of the color layer
- Viewport-only sampling
- On-device cache only
- No backend tile generation
- No animated particles

### Visual treatment

The map must remain readable. The overlay should feel like assistance, not a takeover.

- Wind speed is rendered as a low-opacity color wash.
- Wind direction is rendered with sparse arrows.
- Arrows must be lower density than color cells.
- If the view is too dense, reduce arrow count before reducing map readability.

### Zoom-adaptive density

Overlay density changes with zoom:

- low zoom -> coarse grid, fewer arrows
- medium zoom -> medium density
- high zoom -> finer grid for the visible viewport

Hard caps are required so a large viewport cannot trigger an unbounded number of point fetches.

## Data and Fetching Model

### Why this is separate from the current point forecast flow

The current forecast pipeline is built around one location at a time:

- [src/lib/services/openMeteo.ts](/Users/szymonkocot/Projects/fpv-blast/src/lib/services/openMeteo.ts)
- [src/lib/stores/windStore.ts](/Users/szymonkocot/Projects/fpv-blast/src/lib/stores/windStore.ts)

That pipeline produces a single altitude-vs-time grid for one point. The wind map instead needs many points for one viewport and one selected hour. It should therefore be added beside the current forecast flow, not forced into it.

### New fetch shape

Add a dedicated map-overlay fetch path that:

1. reads current map bounds and zoom
2. converts zoom into sampling density
3. generates viewport sample coordinates
4. fetches wind for those sample points
5. caches results locally
6. renders speed + direction for the selected hour

### Request fields

The overlay will need:

- wind speed at `20 m` or enough nearby levels to interpolate to `20 m`
- wind direction for the same height/hour

If the provider cannot give native `20 m`, fetch available heights and interpolate to `20 m` in the map-overlay pipeline.

### Selected hour

The overlay is rendered for one chosen forecast hour at a time. The hour selector lives in the map screen chrome. Changing the hour invalidates the rendered overlay view but should reuse cached sample data where possible.

## Caching

### Storage

Use on-device storage, following the same resilience rules as the existing forecast cache:

- tolerate unavailable storage
- degrade gracefully
- avoid blocking the UI on cache failures

### Cache key

Each sampled point should be cached by a stable key derived from:

- rounded latitude
- rounded longitude
- forecast hour
- overlay height (`20 m`)
- model configuration / version marker

Rounded coordinates should align with the active grid density so nearby viewport refreshes can reuse existing data instead of refetching nearly identical points.

### Cache behavior

- render cached cells immediately when available
- fetch only missing or stale samples
- on pan/zoom, reuse overlapping cached cells
- on zoom-density changes, keep reusable coarse data until finer samples arrive

## UI Structure

### Top area

- back action
- search input
- `Auto / Custom` toggle
- compact overlay controls for hour and height

Version 1 keeps height fixed to `20 m`, but the control strip should be laid out so a future height selector can live there without a redesign.

### Map body

- base MapLibre map
- wind speed color layer
- sparse direction arrow layer
- center pin when selecting a custom spot

### Bottom sheet

The bottom area communicates current state and primary action.

In `Auto`:

- explain that browsing does not change the active location
- offer action to switch to `Custom`

In `Custom`:

- show candidate place name / coordinates
- offer explicit `Use this spot`

## State Model

Keep active app location state separate from temporary map browsing state.

Suggested split:

- `locationMode`: existing persisted mode
- `activeLocation`: current app forecast location
- `mapCenter`: current viewed map center
- `pendingCustomLocation`: candidate custom location while browsing in `Custom`

Rules:

- In `Auto`, `activeLocation` remains GPS-based even if `mapCenter` moves.
- In `Custom`, moving the map updates `pendingCustomLocation`, not `activeLocation`.
- `Use this spot` promotes `pendingCustomLocation` to saved custom location and active location.

## Error Handling

- If map tiles fail, show the existing map-unavailable treatment.
- If overlay fetches partially fail, render whatever cached or successful samples exist.
- If too few overlay samples are available, fall back to a sparse or empty overlay rather than blocking the map.
- If geolocation fails in `Auto`, fall back to the current existing fallback behavior.

## Performance Constraints

- debounce pan/zoom-driven overlay refreshes
- cap maximum number of sampled points per viewport
- reduce arrow density before reducing map readability
- prefer progressive fill from cache instead of waiting for all samples
- keep canvas-based overlay rendering lightweight enough for mobile PWA usage

## Suggested Implementation Breakdown

1. Create shared `WindMap` screen and replace current `LocationPicker` entry flow.
2. Move location-mode management from settings into the new map screen.
3. Add main-screen `Map` entry point.
4. Implement separate overlay store/service for viewport sampling and caching.
5. Render speed wash + sparse arrows on top of MapLibre.
6. Add `Auto / Custom` behavior and explicit custom confirmation.
7. Remove obsolete settings affordances tied to the old picker flow.

## Testing

### Unit

- viewport-grid generation by zoom tier
- cache key generation and reuse
- custom-commit state transitions
- auto-mode browsing does not mutate active location
- interpolation to `20 m` if needed

### Integration / UI

- open map from main screen in `Auto` and `Custom`
- switch `Auto <-> Custom`
- pan in `Auto` and confirm active location does not change
- pan/search in `Custom`, confirm no change until `Use this spot`
- confirm `Use this spot` updates app forecast location
- zoom changes overlay density without runaway fetch volume

## Out of Scope

- full-country high-detail rendering in one shot
- backend tile or precompute service
- animated wind particles
- multiple altitude layers in v1
- replacing the main heatmap with the map as the primary app surface
