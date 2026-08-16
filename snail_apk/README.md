# 🐌 Snail Sexing AI — Flutter (Android APK)

A mobile port of the web app: scan a snail with the **live camera** (viewfinder
+ torch), classify **sex** and **pregnancy** via the FastAPI server, and keep
records **on-device** (shared_preferences — no Firebase needed, works offline).

Screens: Onboarding · Home (counts + recent) · Scan (live camera / gallery) ·
History (search + filters) · Detail (view/edit/delete) · Stats (pie + bar charts).

## Build the APK

```bash
flutter pub get
flutter build apk --release
# → build/app/outputs/flutter-apk/app-release.apk
```

Requires Flutter stable + Android SDK (platform 36). The APK is ~55 MB
(arm64-v8a + armeabi-v7a + x86_64). For a smaller per-architecture build:
`flutter build apk --release --split-per-abi`.

## Configuration (build-time dart-defines)

| Flag | Default | Purpose |
|---|---|---|
| `API_URL` | `https://snail-api.onrender.com` | Classification server base URL. For the LAN booth demo: `--dart-define=API_URL=http://192.168.1.10:8000` (cleartext HTTP is enabled in the manifest) |
| `CYCLE_MODE` | off | `--dart-define=CYCLE_MODE=true` → booth demo: every scan shows the next result **Male → Female → Female Pregnant**, no server needed |

Examples:

```bash
# Real API (deployed FastAPI server)
flutter build apk --release

# LAN science-fair demo (FastAPI on your laptop, phone on same Wi-Fi)
flutter build apk --release --dart-define=API_URL=http://192.168.1.10:8000

# Cycle demo (rotates results, works offline, no server)
flutter build apk --release --dart-define=CYCLE_MODE=true
```

## Install on a phone

Transfer the APK to the phone (USB, Drive, or `adb install`), open it, and
allow "Install unknown apps" for the source app. Camera permission is
requested when you first open the scanner; gallery upload works without it.

## Storage

Records are saved as a JSON list in shared_preferences (photo stored as a
compressed ~480px JPEG base64 string, mirroring the web app's `compressImage`).
Clear app data to wipe all records.

## Notes

- The classification API contract matches the web app: multipart POST to
  `/classify` with field `image` → `{sex, pregnancyStatus, confidence,
  morphologicalNotes, snailDetected}`. "No snail" photos show "No Snail
  Detected"; if the server is unreachable the app falls back to a mock result.
- Booth pin mode (fixed per-snail results) lives server-side, so the APK
  automatically uses pinned results when talking to a server that has
  `demo_pins.json` configured.
