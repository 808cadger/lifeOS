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

## SRE & DevOps (2026 Standards)
- **SLOs**: 99.9% availability, <200ms P95 latency, 0.1% error budget monthly.
- **SLIs**: Track uptime, latency, error rate via Prometheus/Grafana.
- **Deploy**: Zero-downtime (blue-green, canary); IaC-first (Pulumi/Terraform).
- **MCP Integration**: Use MCP for secure cloud access (AWS, Vercel).
- **Monitoring**: Golden signals + AI anomaly detection in every app.
- **Chatbot**: Embed agentic chatbot in every app (UI + API + safe prompts).

### Auto-Debug Engine (Always On)
- **Before every change**: Run tests/lint, show output, fix failures first.
- **After code**: Self-review: "Does this pass SRE checks? Edge cases? Security?"
- **Loop**: If error found → fix → retest → confirm clean → proceed.
- **Tools**: Enable Playwright MCP for UI tests; background terminal for logs.
- **Commands**: /doctor for health check; /memory to log fixes learned.
- **Never skip**: No deploy without "Debug complete: [tests passed]".

## Goal
Ship production-ready agentic AI apps with embedded chatbots, SRE-grade reliability, and Fiverr-ready polish. Every deploy <30min.
