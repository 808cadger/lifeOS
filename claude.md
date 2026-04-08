# LifeOS - Personal Life Management Hub
6-tab life dashboard: Today alerts, Schedule (calendar sync), Legal deadlines, Finance (bill scan), Home maintenance, Work shifts. AI assistant routes to correct tab. PWA/Capacitor/Electron.

Repo: https://github.com/808cadger/lifeOS. Dev: cadger808 (Pearl City, HI).

## Stack & Design System
- Frontend: Vanilla JS (index.html, app.js, www/, magic-link.js, notifications.js)
- Tabs: Today | Schedule | Legal | Finance | Home | Work
- Widgets: avatar-widget.js, share-widget.js
- Mobile: Capacitor (www/ → android)
- Desktop: Electron (electron/)
- AI: Claude Haiku/Sonnet (tab routing)
- Design: Claude parchment #f5f4ed, Terracotta CTAs

## Key Files & Tab Pipeline
app.js (tab router) | magic-link.js | notifications.js | www/ (assets)

## Commands
npm install
npx cap sync android && cd android && ./gradlew assembleDebug
npx serve .

## Code Rules — LifeOS 6-Tab Pipeline
- **Tab Router**: User query → "Schedule? Legal? Finance?" → correct tab
- **Today Dashboard**: Urgent alerts first (legal deadlines, bills due, shifts)
- **#ASSUMPTION**: localStorage profile loaded; TODO: migration check
- **Bill Scanner**: Photo → OCR → amount/due date → Finance tab
- **Notifications**: Push for deadlines/shifts (Legal/Work tabs)
- **Magic Link**: Deep link to tab (lifeos://legal/123)
- **Phases**: MVP (tabs) → Calendar sync → Voice → Family sharing

## AI Prompts — Life Critical

## Claude Workflow (Auto-Debug ON)
1. Read CLAUDE.md + app.js (tab logic) first
2. /doctor → lint/notifications
3. "Correct tab? Dashboard priority?"
4. Review: Cross-tab data flow? Notification safe?
5. Output: "Debug complete" + patches
6. Commit: "feat: [today|schedule|legal|finance|home|work] [desc]"

## Deploy Checklist

**Your factory = 8 apps complete**: GlowAI, AutoIQ, CourtAide, FarmSense, RepairIQ, JobHalo, HaloGuard, **LifeOS**. Every repo identical CLAUDE.md structure. Commit → your cadger808 empire ships at 99.9% SRE automatically.
