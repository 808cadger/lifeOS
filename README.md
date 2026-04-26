# LifeOS — Your Life, Organized

<!-- INSTALL-START -->
## Install and run

These instructions install and run `lifeOS` from a fresh clone.

### Clone
```bash
git clone https://github.com/808cadger/lifeOS.git
cd lifeOS
```

### Web app
```bash
npm install
python3 -m http.server 8080
```

### Android build/open
```bash
npm run cap:sync
npx cap open android
```

### Desktop app
```bash
npm run electron
npm run electron:dist
```

### Notes
- Use Node.js 22 or newer for the current package set.
- Android builds require Android Studio, a configured SDK, and Java 21 when Gradle is used.

### AI/API setup
- If the app has AI features, add the required provider key in the app settings or local `.env` file.
- Browser-only apps store user-provided API keys on the local device unless a backend endpoint is configured.

### License
- Apache License 2.0. See [`LICENSE`](./LICENSE).
<!-- INSTALL-END -->


Your personal operating system for everyday life. Schedule, legal deadlines, bills, home maintenance, work shifts — all in one place with an AI assistant in the corner.

**For the everyday person. Not a corporation. Not a politician. Just you.**

## Can anyone use this?

**Yes.** Open the link, tap "Add to Home Screen", enter your Claude API key in Settings — done.

→ **PWA:** https://cadger808.codeberg.page/lifeos
→ **Android APK:** [Download LifeOS-v1.0.0.apk](https://codeberg.org/cadger808/lifeos/releases/download/v1.0.0/LifeOS-v1.0.0.apk)
→ **All Releases:** https://codeberg.org/cadger808/lifeos/releases

## What it does

| Screen | Purpose |
|--------|---------|
| Today | Dashboard — alerts, today's events, urgent deadlines |
| Schedule | Add events and reminders with notifications |
| Legal | Track court dates, lease renewals, filing deadlines |
| Finance | Bills tracker, budget, expense log |
| Home | Maintenance schedule, repair history |
| Work | Shift log, hours, estimated pay |
| Accounts | Enable notifications, link Google Calendar |
| Settings | Name, Claude API key |

## Install

| Method | Steps |
|--------|-------|
| PWA (any device) | Open link → Add to Home Screen |
| Android APK | Download from Releases → Install |
| Linux Desktop | Download AppImage → Run |

## Dev

```bash
npm install
npx cap sync android
cd android && ./gradlew assembleDebug
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
npm run electron:dist
```

## Stack

HTML + Capacitor + Electron | Claude AI (Haiku + Sonnet) | No backend — all local storage
