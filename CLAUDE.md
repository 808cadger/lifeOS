# CLAUDE.md — LifeOS

Personal life management hub — schedule, legal, finance, home, work, AI assistant.
Stack: HTML + Capacitor + Electron | Deploy: APK + PWA + Electron AppImage/RPM

## Repo Identity
- Codeberg: https://codeberg.org/cadger808/lifeos
- PWA: https://cadger808.codeberg.page/lifeos
- Releases: https://codeberg.org/cadger808/lifeos/releases

## Key Files
- `index.html` — single-page app, all 8 screens + modals
- `app.js` — state management, routing, all screen logic
- `notifications.js` — Web Notifications API + Capacitor LocalNotifications
- `api-client.js` — Claude API client (retry + circuit breaker)
- `avatar-widget.js` — Jedi droid floating AI assistant
- `share-widget.js` — share/install/download widget
- `sw.js` — service worker, offline support
- `electron/main.js` — Electron desktop entry + tray
- `electron/preload.js` — Electron IPC bridge

## Screens
- today, schedule, legal, finance, home, work, accounts, settings

## Commands
```bash
npm install
npx cap sync android
cd android && ./gradlew assembleDebug
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
npm run electron:dist
```

## Assumption-Driven Coding
1. Add `// #ASSUMPTION: ...` for every non-trivial assumption.
2. Ask: what test would break this assumption?
3. Add `// TODO: validate ...` where needed.
4. Review all #ASSUMPTION lines before marking done.
