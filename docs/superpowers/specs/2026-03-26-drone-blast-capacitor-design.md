---
title: Drone Blast — Rename + Android Capacitor Setup
date: 2026-03-26
status: approved
---

## Overview

Two goals:
1. Complete the rename from "FPV Blast" to "Drone Blast" across all remaining references.
2. Add Capacitor to produce a buildable Android APK from the existing Svelte/Vite PWA.

---

## Part 1: Rename

The app is already named "Drone Blast" in `index.html`, `public/manifest.json`, and `src/lib/i18n/en.ts`. The following files still reference the old name and must be updated:

| File | Change |
|------|--------|
| `package.json` | `"name": "fpv-blast"` → `"drone-blast"` |
| `package-lock.json` | same |
| `src/lib/stores/settingsStore.ts` | `STORAGE_KEY = 'fpvblast-settings'` → `'droneblast-settings'` |
| `playwright.config.ts` | `baseURL` path segment `/fpv-blast/` → `/` (also aligns with Capacitor) |
| `e2e/location-mode-refetch.spec.ts` | `BASE` constant same path fix |
| `README.md` | git clone URL and `cd` command |

**Storage key note:** Changing `STORAGE_KEY` means existing installs lose saved settings (thresholds, units, appearance). Acceptable for this rename; no migration needed.

Historical files (`docs/superpowers/`, `.superpowers/brainstorm/`) are left as-is — they are archival records.

---

## Part 2: Capacitor Android

### Dependencies

Add to project:
- `@capacitor/core`
- `@capacitor/cli` (dev)
- `@capacitor/android`

### Configuration

Create `capacitor.config.ts` at project root:

```ts
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.droneblast.app',
  appName: 'Drone Blast',
  webDir: 'dist',
};

export default config;
```

### Android project scaffold

Run `npx cap add android` once to generate the `android/` directory. This is committed to the repo.

### Build script

Add to `package.json` scripts:
```json
"build:android": "vite build && cap sync android"
```

### Service worker

The PWA service worker cannot register under `capacitor://` — it will silently fail. No code change needed; the app works fine without it in the Capacitor context.

### APK generation workflow

1. `npm run build:android`
2. Open Android Studio → `android/` folder
3. Build → Generate Signed Bundle/APK

---

## Out of scope

- iOS / Capacitor iOS setup
- Capacitor plugins (camera, push notifications, etc.)
- CI/CD for APK signing
