---
title: Drone Blast — Android Signed Release CI
date: 2026-03-26
status: approved
---

## Overview

Add a GitHub Actions workflow that builds and signs a release APK whenever a `v*` tag is pushed, and attaches it to a GitHub Release automatically.

---

## Trigger

```yaml
on:
  push:
    tags:
      - 'v*'
```

Pushing `git tag v1.0 && git push origin v1.0` starts the build. The resulting APK is attached to a GitHub Release named after the tag.

---

## Workflow: `.github/workflows/android-release.yml`

Runs on `ubuntu-latest`. Single job: `build`.

### Steps

1. `actions/checkout@v4`
2. `actions/setup-java@v4` — distribution `temurin`, version `17` (required by AGP 8.x)
3. `actions/setup-node@v4` — version `24`, cache `npm`
4. `npm ci --legacy-peer-deps` — matches existing `deploy.yml`
5. `npm run build` — no `VITE_BASE_PATH` (Capacitor serves from `/`)
6. `npx cap sync android` — copies `dist/` into `android/app/src/main/assets/public/`
7. Decode keystore — `echo "$KEYSTORE_BASE64" | base64 --decode > /tmp/drone-blast.keystore`
8. `cd android && ./gradlew assembleRelease` — env vars: `KEYSTORE_PATH`, `STORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`
9. `softprops/action-gh-releases@v2` — upload `android/app/build/outputs/apk/release/app-release.apk`, tag name = release name

### Secrets used (pre-configured in repo)

| Secret | Description |
|--------|-------------|
| `KEYSTORE_BASE64` | base64-encoded `.keystore` file |
| `STORE_PASSWORD` | keystore password |
| `KEY_ALIAS` | `drone-blast` |
| `KEY_PASSWORD` | key password |

`GITHUB_TOKEN` (built-in) is used for creating the release.

---

## Gradle signing config: `android/app/build.gradle`

Add a `signingConfigs.release` block before `buildTypes`, reading all values from environment variables:

```gradle
signingConfigs {
    release {
        storeFile file(System.getenv("KEYSTORE_PATH") ?: "release.keystore")
        storePassword System.getenv("STORE_PASSWORD") ?: ""
        keyAlias System.getenv("KEY_ALIAS") ?: ""
        keyPassword System.getenv("KEY_PASSWORD") ?: ""
    }
}
```

Wire it into the existing `buildTypes.release`:

```gradle
buildTypes {
    release {
        signingConfig signingConfigs.release
        minifyEnabled false
        proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
    }
}
```

No secrets are hardcoded — the file is safe to commit.

---

## Release workflow for the developer

```bash
git tag v1.0
git push origin v1.0
```

~5 minutes later: signed APK appears on the GitHub Releases page, ready to download and sideload.

---

## Out of scope

- Debug APK builds
- Google Play Store publishing
- iOS / App Store builds
- Version code auto-increment
