/* notifications.js — LifeOS notification scheduler
 * Web Notifications API (PWA/Electron) + Capacitor LocalNotifications (APK)
 * #ASSUMPTION: Capacitor is available on Android; falls back to Web API on PWA/Electron
 */
(function () {
  'use strict';

  var STORE_KEY = 'lifeos_notifications';
  var _timers   = {};

  function load() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); } catch(e) { return []; }
  }

  function save(list) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(list)); } catch(e) {}
  }

  /* ── Request permission ──────────────────────── */
  async function requestPermission() {
    // Capacitor path
    if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
      try {
        var { LocalNotifications } = await import('@capacitor/local-notifications');
        await LocalNotifications.requestPermissions();
        return true;
      } catch(e) { /* fall through to web */ }
    }
    // Web path
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    var result = await Notification.requestPermission();
    return result === 'granted';
  }

  /* ── Schedule a notification ─────────────────── */
  async function schedule(id, title, body, timestampMs) {
    var list = load();
    list = list.filter(function(n) { return n.id !== id; });
    list.push({ id: id, title: title, body: body, timestamp: timestampMs, fired: false });
    save(list);

    // Capacitor path
    if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
      try {
        var { LocalNotifications } = await import('@capacitor/local-notifications');
        await LocalNotifications.schedule({
          notifications: [{
            id: Math.abs(id | 0) || 1,
            title: title,
            body: body,
            schedule: { at: new Date(timestampMs) },
            smallIcon: 'ic_stat_icon_config_sample',
          }]
        });
        return;
      } catch(e) { /* fall through */ }
    }

    // Web path — setTimeout for same-session, SW handles cross-session
    var delay = timestampMs - Date.now();
    if (delay > 0) {
      clearTimeout(_timers[id]);
      _timers[id] = setTimeout(function() { fire(title, body); }, Math.min(delay, 2147483647));
    }
  }

  /* ── Cancel a notification ───────────────────── */
  function cancel(id) {
    var list = load().filter(function(n) { return n.id !== id; });
    save(list);
    clearTimeout(_timers[id]);
    delete _timers[id];
  }

  /* ── Fire a Web Notification ─────────────────── */
  function fire(title, body) {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(title, { body: body, icon: './icons/icon-192.png', badge: './icons/icon-192.png' });
    }
  }

  /* ── Check pending on app open ───────────────── */
  function checkPending() {
    var now  = Date.now();
    var list = load();
    var changed = false;
    list.forEach(function(n) {
      if (!n.fired && n.timestamp <= now) {
        fire(n.title, n.body);
        n.fired = true;
        changed = true;
      }
    });
    if (changed) save(list);
    // Reload timers for future notifications
    list.forEach(function(n) {
      if (!n.fired && n.timestamp > now) {
        var delay = n.timestamp - now;
        clearTimeout(_timers[n.id]);
        _timers[n.id] = setTimeout(function() { fire(n.title, n.body); }, Math.min(delay, 2147483647));
      }
    });
  }

  window.LifeNotif = {
    request: requestPermission,
    schedule: schedule,
    cancel: cancel,
    checkPending: checkPending,
  };
})();
