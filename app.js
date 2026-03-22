/* app.js — LifeOS core state, routing, and screen logic
 * #ASSUMPTION: localStorage is available (all target platforms support it)
 * #ASSUMPTION: index.html DOM is fully parsed before this script runs (defer)
 */
(function () {
  'use strict';

  /* ════════════════════════════════════════════
     STATE
  ════════════════════════════════════════════ */
  var STORE_KEY = 'lifeos_state';

  var DEFAULT = {
    profile: { name: '', apiKey: '' },
    schedule: [],   // [{id, title, date, time, category, notifMs}]
    legal:    [],   // [{id, title, dueDate, type, notes, notifMs}]
    finance:  { bills: [], expenses: [], budget: { income: 0, spent: 0 } },
    home:     { maintenance: [], repairs: [] },
    work:     { shifts: [], rate: 0 },
    accounts: { googleCal: '', notifications: true },
  };

  var state = JSON.parse(JSON.stringify(DEFAULT));

  function loadState() {
    try {
      var saved = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
      // Deep merge saved into defaults so new keys always exist
      state = deepMerge(DEFAULT, saved);
    } catch(e) { state = JSON.parse(JSON.stringify(DEFAULT)); }
  }

  function saveState() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch(e) {}
  }

  function deepMerge(target, source) {
    var out = JSON.parse(JSON.stringify(target));
    if (!source || typeof source !== 'object') return out;
    Object.keys(source).forEach(function(k) {
      if (Array.isArray(source[k])) {
        out[k] = source[k];
      } else if (source[k] && typeof source[k] === 'object') {
        out[k] = deepMerge(out[k] || {}, source[k]);
      } else if (source[k] !== undefined) {
        out[k] = source[k];
      }
    });
    return out;
  }

  /* ════════════════════════════════════════════
     ROUTING
  ════════════════════════════════════════════ */
  var _currentScreen = 'today';

  function showScreen(name) {
    document.querySelectorAll('.screen').forEach(function(el) {
      el.classList.toggle('active', el.id === 'screen-' + name);
    });
    document.querySelectorAll('.nav-btn').forEach(function(btn) {
      btn.classList.toggle('active', btn.dataset.screen === name);
    });
    // Update avatar context
    var avatarEl = document.getElementById('sw-avatar');
    var ctx = SCREEN_CONTEXT[name] || 'a life management app';
    if (avatarEl) avatarEl.dataset.context = ctx;
    _currentScreen = name;
    renderScreen(name);
    // Close more menu if open
    closeMoreMenu();
  }

  var SCREEN_CONTEXT = {
    today:    'LifeOS dashboard — help me prioritize tasks, manage my schedule, and stay on top of deadlines',
    schedule: 'LifeOS schedule — help me plan my time, block calendar slots, and set reminders',
    legal:    'LifeOS legal tracker — help me understand deadlines, court notices, lease terms, and legal rights',
    finance:  'LifeOS finance — help me track bills, budget, and manage expenses for everyday living',
    home:     'LifeOS home management — help me track maintenance, repairs, and property records',
    work:     'LifeOS work tracker — help me log shifts, calculate pay, and manage my work schedule',
    accounts: 'LifeOS accounts — help me set up notifications and connected accounts',
    settings: 'LifeOS settings — help me configure the app',
  };

  /* ════════════════════════════════════════════
     HELPERS
  ════════════════════════════════════════════ */
  function escHtml(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function genId() { return Date.now() + '_' + Math.random().toString(36).slice(2, 7); }

  function fmtDate(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function fmtTime(t) {
    if (!t) return '';
    var [h, m] = t.split(':').map(Number);
    var ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return h + ':' + String(m).padStart(2, '0') + ' ' + ampm;
  }

  function daysUntil(isoDate) {
    var now  = new Date(); now.setHours(0,0,0,0);
    var then = new Date(isoDate); then.setHours(0,0,0,0);
    return Math.round((then - now) / 86400000);
  }

  function urgencyClass(days) {
    if (days < 0)  return 'overdue';
    if (days <= 3) return 'urgent';
    if (days <= 7) return 'soon';
    return 'ok';
  }

  function urgencyLabel(days) {
    if (days < 0)  return 'Overdue';
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    if (days <= 7) return days + ' days';
    return fmtDate(new Date(Date.now() + days * 86400000).toISOString().slice(0, 10));
  }

  function showToast(msg, type) {
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.className = 'toast show' + (type ? ' ' + type : '');
    clearTimeout(t._to);
    t._to = setTimeout(function() { t.className = 'toast'; }, 2800);
  }

  /* ════════════════════════════════════════════
     MODAL
  ════════════════════════════════════════════ */
  function openModal(id) {
    document.getElementById('modal-overlay').classList.remove('hidden');
    document.querySelectorAll('.modal').forEach(function(m) {
      m.classList.toggle('active', m.id === id);
    });
  }

  function closeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
    document.querySelectorAll('.modal').forEach(function(m) { m.classList.remove('active'); });
    // Clear all form inputs
    document.querySelectorAll('.modal input, .modal textarea, .modal select').forEach(function(el) {
      if (el.tagName === 'SELECT') el.selectedIndex = 0;
      else el.value = '';
    });
  }

  /* ════════════════════════════════════════════
     MORE MENU
  ════════════════════════════════════════════ */
  function closeMoreMenu() {
    var menu = document.getElementById('more-menu');
    if (menu) menu.classList.add('hidden');
  }

  /* ════════════════════════════════════════════
     TODAY SCREEN
  ════════════════════════════════════════════ */
  function renderToday() {
    var name = state.profile.name ? ', ' + state.profile.name.split(' ')[0] : '';
    var h = new Date().getHours();
    var greeting = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
    var el = document.getElementById('today-greeting');
    if (el) el.textContent = greeting + name;

    // Date
    var dateEl = document.getElementById('today-date');
    if (dateEl) dateEl.textContent = new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' });

    // Stats
    var today = new Date().toISOString().slice(0,10);
    var todayEvents = state.schedule.filter(function(e) { return e.date === today; });
    var overdueDeadlines = state.legal.filter(function(d) { return daysUntil(d.dueDate) < 0; });
    var urgentDeadlines  = state.legal.filter(function(d) { var n = daysUntil(d.dueDate); return n >= 0 && n <= 3; });
    var dueBills = (state.finance.bills || []).filter(function(b) { return !b.paid && daysUntil(b.dueDate) <= 3 && daysUntil(b.dueDate) >= 0; });

    var statsEl = document.getElementById('today-stats');
    if (statsEl) statsEl.innerHTML =
      '<div class="stat-card blue"><div class="stat-num">' + todayEvents.length + '</div><div class="stat-label">Today\'s Events</div></div>' +
      '<div class="stat-card red"><div class="stat-num">' + (overdueDeadlines.length + urgentDeadlines.length) + '</div><div class="stat-label">Legal Alerts</div></div>' +
      '<div class="stat-card green"><div class="stat-num">' + dueBills.length + '</div><div class="stat-label">Bills Due Soon</div></div>';

    // Alerts
    var alerts = [];
    overdueDeadlines.forEach(function(d) {
      alerts.push({ type:'overdue', icon:'⚖️', text: d.title + ' is OVERDUE', action: function(){ showScreen('legal'); } });
    });
    urgentDeadlines.forEach(function(d) {
      var days = daysUntil(d.dueDate);
      alerts.push({ type:'urgent', icon:'⚖️', text: d.title + ' due in ' + days + ' day' + (days===1?'':'s'), action: function(){ showScreen('legal'); } });
    });
    dueBills.forEach(function(b) {
      var days = daysUntil(b.dueDate);
      alerts.push({ type:'urgent', icon:'💵', text: b.title + ' $' + b.amount + ' due in ' + days + ' day' + (days===1?'':'s'), action: function(){ showScreen('finance'); } });
    });

    var alertsEl = document.getElementById('today-alerts');
    if (alertsEl) {
      if (alerts.length) {
        alertsEl.innerHTML = alerts.map(function(a) {
          return '<div class="alert-row ' + a.type + '">' + a.icon + ' ' + escHtml(a.text) + '</div>';
        }).join('');
        alertsEl.querySelectorAll('.alert-row').forEach(function(row, i) {
          row.style.cursor = 'pointer';
          row.onclick = alerts[i].action;
        });
      } else {
        alertsEl.innerHTML = '<div class="empty-alerts">✅ All clear — no urgent alerts</div>';
      }
    }

    // Today's schedule
    var schedEl = document.getElementById('today-schedule');
    if (schedEl) {
      if (todayEvents.length) {
        schedEl.innerHTML = todayEvents.sort(function(a,b){ return (a.time||'').localeCompare(b.time||''); }).map(function(e) {
          return '<div class="today-event"><span class="event-time">' + fmtTime(e.time) + '</span><span class="event-title">' + escHtml(e.title) + '</span><span class="event-cat cat-' + escHtml(e.category||'other') + '">' + escHtml(e.category||'') + '</span></div>';
        }).join('');
      } else {
        schedEl.innerHTML = '<div class="empty-state-sm">No events today — <button class="link-btn" onclick="openModal(\'modal-add-event\')">add one</button></div>';
      }
    }
  }

  /* ════════════════════════════════════════════
     SCHEDULE SCREEN
  ════════════════════════════════════════════ */
  function renderSchedule() {
    var listEl = document.getElementById('schedule-list');
    if (!listEl) return;
    var today = new Date().toISOString().slice(0,10);
    var upcoming = state.schedule
      .filter(function(e) { return e.date >= today; })
      .sort(function(a,b) { return (a.date + (a.time||'')).localeCompare(b.date + (b.time||'')); });
    var past = state.schedule
      .filter(function(e) { return e.date < today; })
      .sort(function(a,b) { return b.date.localeCompare(a.date); })
      .slice(0, 5);

    if (!state.schedule.length) {
      listEl.innerHTML = '<div class="empty-state"><div class="empty-icon">📅</div><p>No events yet.<br>Tap + to add your first event.</p></div>';
      return;
    }

    listEl.innerHTML =
      (upcoming.length ? '<div class="section-label">Upcoming</div>' + upcoming.map(eventCard).join('') : '') +
      (past.length ? '<div class="section-label muted">Past (last 5)</div>' + past.map(eventCard).join('') : '');
  }

  function eventCard(e) {
    var days = daysUntil(e.date);
    return '<div class="list-card" data-id="' + escHtml(e.id) + '">' +
      '<div class="list-card-left">' +
      '<div class="list-card-title">' + escHtml(e.title) + '</div>' +
      '<div class="list-card-sub">' + fmtDate(e.date) + (e.time ? ' · ' + fmtTime(e.time) : '') + '</div>' +
      '</div>' +
      '<div class="list-card-right">' +
      '<span class="event-cat cat-' + escHtml(e.category||'other') + '">' + escHtml(e.category||'other') + '</span>' +
      '<button class="delete-btn" data-type="event" data-id="' + escHtml(e.id) + '">✕</button>' +
      '</div></div>';
  }

  function addEvent(data) {
    // #ASSUMPTION: data.date is YYYY-MM-DD, data.time is HH:MM or empty
    var item = {
      id: genId(), title: data.title, date: data.date,
      time: data.time || '', category: data.category || 'other',
    };
    state.schedule.push(item);
    saveState();
    // Schedule notification 30 min before if time set
    if (data.time && window.LifeNotif) {
      var dt = new Date(data.date + 'T' + data.time);
      var notifTime = dt.getTime() - 30 * 60 * 1000;
      if (notifTime > Date.now()) {
        LifeNotif.schedule('event_' + item.id, '📅 ' + item.title, '30 minutes away — get ready!', notifTime);
      }
    }
    renderSchedule();
    renderToday();
    showToast('Event added');
  }

  /* ════════════════════════════════════════════
     LEGAL SCREEN
  ════════════════════════════════════════════ */
  function renderLegal() {
    var listEl = document.getElementById('legal-list');
    if (!listEl) return;
    if (!state.legal.length) {
      listEl.innerHTML = '<div class="empty-state"><div class="empty-icon">⚖️</div><p>No deadlines tracked.<br>Tap + to add a court date, lease renewal, or any legal deadline.</p></div>';
      return;
    }
    var sorted = state.legal.slice().sort(function(a,b) { return new Date(a.dueDate) - new Date(b.dueDate); });
    listEl.innerHTML = sorted.map(function(d) {
      var days = daysUntil(d.dueDate);
      var uc = urgencyClass(days);
      return '<div class="list-card legal-card ' + uc + '">' +
        '<div class="list-card-left">' +
        '<div class="urgency-badge ' + uc + '">' + urgencyLabel(days) + '</div>' +
        '<div class="list-card-title">' + escHtml(d.title) + '</div>' +
        '<div class="list-card-sub">' + escHtml(d.type||'') + (d.notes ? ' · ' + escHtml(d.notes) : '') + '</div>' +
        '</div>' +
        '<div class="list-card-right">' +
        '<div class="list-card-date">' + fmtDate(d.dueDate) + '</div>' +
        '<button class="delete-btn" data-type="legal" data-id="' + escHtml(d.id) + '">✕</button>' +
        '</div></div>';
    }).join('');
  }

  function addLegal(data) {
    var item = { id: genId(), title: data.title, dueDate: data.dueDate, type: data.type || 'Other', notes: data.notes || '' };
    state.legal.push(item);
    saveState();
    // Notify 2 days before
    if (window.LifeNotif) {
      var notifTime = new Date(data.dueDate).getTime() - 2 * 86400000;
      if (notifTime > Date.now()) {
        LifeNotif.schedule('legal_' + item.id, '⚖️ ' + item.title, 'Due in 2 days — check CourtAide for help.', notifTime);
      }
    }
    renderLegal();
    renderToday();
    showToast('Deadline added');
  }

  /* ════════════════════════════════════════════
     FINANCE SCREEN
  ════════════════════════════════════════════ */
  function renderFinance() {
    var bills    = state.finance.bills    || [];
    var expenses = state.finance.expenses || [];
    var budget   = state.finance.budget   || { income: 0, spent: 0 };

    // Budget bar
    var budgetEl = document.getElementById('finance-budget');
    if (budgetEl) {
      var income = Number(budget.income) || 0;
      var spent  = expenses.reduce(function(s, e) { return s + Number(e.amount||0); }, 0);
      var pct    = income > 0 ? Math.min(100, Math.round(spent / income * 100)) : 0;
      var barColor = pct >= 90 ? '#ef5350' : pct >= 70 ? '#ffa726' : '#66bb6a';
      budgetEl.innerHTML =
        '<div class="budget-row"><span>Budget</span><span>$' + spent.toFixed(2) + ' / $' + income.toFixed(2) + '</span></div>' +
        '<div class="budget-bar-bg"><div class="budget-bar-fill" style="width:' + pct + '%;background:' + barColor + '"></div></div>' +
        '<div class="budget-row muted"><span>' + pct + '% used</span><span>$' + Math.max(0, income - spent).toFixed(2) + ' left</span></div>';
    }

    // Bills
    var billsEl = document.getElementById('finance-bills');
    if (billsEl) {
      var sorted = bills.slice().sort(function(a,b) { return new Date(a.dueDate) - new Date(b.dueDate); });
      billsEl.innerHTML = sorted.length ? sorted.map(function(b) {
        var days = daysUntil(b.dueDate);
        var uc = b.paid ? 'ok' : urgencyClass(days);
        return '<div class="list-card ' + uc + '">' +
          '<div class="list-card-left">' +
          '<div class="list-card-title">' + escHtml(b.title) + (b.recurring ? ' <span class="badge">Recurring</span>' : '') + '</div>' +
          '<div class="list-card-sub">$' + Number(b.amount||0).toFixed(2) + ' · ' + fmtDate(b.dueDate) + '</div>' +
          '</div>' +
          '<div class="list-card-right">' +
          (b.paid ? '<span class="paid-badge">Paid</span>' :
            '<span class="urgency-badge ' + uc + '">' + urgencyLabel(days) + '</span>') +
          '<button class="icon-btn" data-action="pay-bill" data-id="' + escHtml(b.id) + '" title="Mark paid">' + (b.paid ? '↩' : '✓') + '</button>' +
          '<button class="delete-btn" data-type="bill" data-id="' + escHtml(b.id) + '">✕</button>' +
          '</div></div>';
      }).join('') : '<div class="empty-state-sm">No bills tracked</div>';
    }

    // Expenses
    var expEl = document.getElementById('finance-expenses');
    if (expEl) {
      var recent = expenses.slice().sort(function(a,b) { return new Date(b.date) - new Date(a.date); }).slice(0,20);
      expEl.innerHTML = recent.length ? recent.map(function(ex) {
        return '<div class="list-card">' +
          '<div class="list-card-left">' +
          '<div class="list-card-title">' + escHtml(ex.title) + '</div>' +
          '<div class="list-card-sub">' + escHtml(ex.category||'') + ' · ' + fmtDate(ex.date) + '</div>' +
          '</div>' +
          '<div class="list-card-right">' +
          '<span class="amount-tag">$' + Number(ex.amount||0).toFixed(2) + '</span>' +
          '<button class="delete-btn" data-type="expense" data-id="' + escHtml(ex.id) + '">✕</button>' +
          '</div></div>';
      }).join('') : '<div class="empty-state-sm">No expenses logged</div>';
    }
  }

  function addBill(data) {
    var item = { id: genId(), title: data.title, amount: data.amount, dueDate: data.dueDate, recurring: !!data.recurring, paid: false };
    state.finance.bills.push(item);
    saveState();
    if (window.LifeNotif) {
      var notifTime = new Date(data.dueDate).getTime() - 3 * 86400000;
      if (notifTime > Date.now()) {
        LifeNotif.schedule('bill_' + item.id, '💵 Bill Due: ' + item.title, '$' + Number(item.amount).toFixed(2) + ' due in 3 days.', notifTime);
      }
    }
    renderFinance();
    renderToday();
    showToast('Bill added');
  }

  function addExpense(data) {
    state.finance.expenses.push({ id: genId(), title: data.title, amount: data.amount, category: data.category || 'Other', date: data.date || new Date().toISOString().slice(0,10) });
    saveState();
    renderFinance();
    showToast('Expense logged');
  }

  /* ════════════════════════════════════════════
     HOME SCREEN
  ════════════════════════════════════════════ */
  function renderHome() {
    var maint = state.home.maintenance || [];
    var repairs = state.home.repairs || [];

    var maintEl = document.getElementById('home-maintenance');
    if (maintEl) {
      maintEl.innerHTML = maint.length ? maint.map(function(m) {
        var nextDate = m.lastDone && m.intervalDays
          ? new Date(new Date(m.lastDone).getTime() + m.intervalDays * 86400000).toISOString().slice(0,10)
          : null;
        var days = nextDate ? daysUntil(nextDate) : null;
        var uc = days !== null ? urgencyClass(days) : 'ok';
        return '<div class="list-card ' + uc + '">' +
          '<div class="list-card-left">' +
          '<div class="list-card-title">🔧 ' + escHtml(m.title) + '</div>' +
          '<div class="list-card-sub">Every ' + (m.intervalDays||'?') + ' days · Last: ' + (m.lastDone ? fmtDate(m.lastDone) : 'Never') + '</div>' +
          '</div>' +
          '<div class="list-card-right">' +
          (nextDate ? '<span class="urgency-badge ' + uc + '">' + urgencyLabel(days) + '</span>' : '') +
          '<button class="icon-btn" data-action="done-maint" data-id="' + escHtml(m.id) + '">✓</button>' +
          '<button class="delete-btn" data-type="maint" data-id="' + escHtml(m.id) + '">✕</button>' +
          '</div></div>';
      }).join('') : '<div class="empty-state-sm">No maintenance tracked</div>';
    }

    var repairEl = document.getElementById('home-repairs');
    if (repairEl) {
      var recent = repairs.slice().sort(function(a,b){ return new Date(b.date)-new Date(a.date); }).slice(0,15);
      repairEl.innerHTML = recent.length ? recent.map(function(r) {
        return '<div class="list-card">' +
          '<div class="list-card-left">' +
          '<div class="list-card-title">🛠 ' + escHtml(r.title) + '</div>' +
          '<div class="list-card-sub">' + fmtDate(r.date) + (r.cost ? ' · $' + Number(r.cost).toFixed(2) : '') + (r.notes ? ' · ' + escHtml(r.notes) : '') + '</div>' +
          '</div>' +
          '<div class="list-card-right"><button class="delete-btn" data-type="repair" data-id="' + escHtml(r.id) + '">✕</button></div>' +
          '</div>';
      }).join('') : '<div class="empty-state-sm">No repairs logged</div>';
    }
  }

  function addMaintenance(data) {
    state.home.maintenance.push({ id: genId(), title: data.title, intervalDays: Number(data.intervalDays)||90, lastDone: data.lastDone || '' });
    saveState(); renderHome(); showToast('Maintenance item added');
  }

  function addRepair(data) {
    state.home.repairs.push({ id: genId(), title: data.title, date: data.date || new Date().toISOString().slice(0,10), cost: data.cost || '', notes: data.notes || '' });
    saveState(); renderHome(); showToast('Repair logged');
  }

  /* ════════════════════════════════════════════
     WORK SCREEN
  ════════════════════════════════════════════ */
  function renderWork() {
    var shifts = state.work.shifts || [];
    var rate   = Number(state.work.rate) || 0;

    var rateEl = document.getElementById('work-rate-display');
    if (rateEl) rateEl.textContent = rate > 0 ? '$' + rate.toFixed(2) + '/hr' : 'Set hourly rate in Add Shift';

    // This week
    var now   = new Date();
    var wkStart = new Date(now); wkStart.setDate(now.getDate() - now.getDay()); wkStart.setHours(0,0,0,0);
    var wkEnd   = new Date(wkStart); wkEnd.setDate(wkStart.getDate() + 7);
    var wkISO   = wkStart.toISOString().slice(0,10);
    var wkEndISO = wkEnd.toISOString().slice(0,10);

    var weekShifts = shifts.filter(function(s) { return s.date >= wkISO && s.date < wkEndISO; });
    var weekHours  = weekShifts.reduce(function(sum, s) {
      if (!s.startTime || !s.endTime) return sum;
      var start = s.startTime.split(':').map(Number);
      var end   = s.endTime.split(':').map(Number);
      var h = (end[0] + end[1]/60) - (start[0] + start[1]/60);
      return sum + Math.max(0, h);
    }, 0);
    var weekPay = weekHours * (Number(s && s.rate || 0) || rate);

    var summaryEl = document.getElementById('work-summary');
    if (summaryEl) summaryEl.innerHTML =
      '<div class="stat-card blue"><div class="stat-num">' + weekShifts.length + '</div><div class="stat-label">Shifts This Week</div></div>' +
      '<div class="stat-card green"><div class="stat-num">' + weekHours.toFixed(1) + 'h</div><div class="stat-label">Hours</div></div>' +
      (rate > 0 ? '<div class="stat-card purple"><div class="stat-num">$' + (weekHours * rate).toFixed(0) + '</div><div class="stat-label">Est. Pay</div></div>' : '');

    var listEl = document.getElementById('work-list');
    if (listEl) {
      var sorted = shifts.slice().sort(function(a,b){ return b.date.localeCompare(a.date); }).slice(0,30);
      listEl.innerHTML = sorted.length ? sorted.map(function(s) {
        var h = 0;
        if (s.startTime && s.endTime) {
          var start = s.startTime.split(':').map(Number);
          var end   = s.endTime.split(':').map(Number);
          h = Math.max(0, (end[0] + end[1]/60) - (start[0] + start[1]/60));
        }
        var r = Number(s.rate || state.work.rate) || 0;
        return '<div class="list-card">' +
          '<div class="list-card-left">' +
          '<div class="list-card-title">' + fmtDate(s.date) + (s.notes ? ' — ' + escHtml(s.notes) : '') + '</div>' +
          '<div class="list-card-sub">' + (s.startTime ? fmtTime(s.startTime) + ' – ' + fmtTime(s.endTime) : 'No times set') + (h > 0 ? ' · ' + h.toFixed(1) + 'h' : '') + '</div>' +
          '</div>' +
          '<div class="list-card-right">' +
          (r > 0 && h > 0 ? '<span class="amount-tag">$' + (h * r).toFixed(2) + '</span>' : '') +
          '<button class="delete-btn" data-type="shift" data-id="' + escHtml(s.id) + '">✕</button>' +
          '</div></div>';
      }).join('') : '<div class="empty-state"><div class="empty-icon">💼</div><p>No shifts logged yet.<br>Tap + to log your first shift.</p></div>';
    }
  }

  function addShift(data) {
    if (data.rate) state.work.rate = Number(data.rate);
    state.work.shifts.push({ id: genId(), date: data.date, startTime: data.startTime || '', endTime: data.endTime || '', rate: Number(data.rate || state.work.rate) || 0, notes: data.notes || '' });
    saveState(); renderWork(); showToast('Shift logged');
  }

  /* ════════════════════════════════════════════
     ACCOUNTS SCREEN
  ════════════════════════════════════════════ */
  function renderAccounts() {
    var calEl = document.getElementById('account-gcal-status');
    if (calEl) {
      calEl.textContent = state.accounts.googleCal
        ? '✅ Google Calendar URL saved'
        : '⚪ Not connected';
    }
    var notifEl = document.getElementById('account-notif-status');
    if (notifEl) {
      var perm = typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';
      notifEl.textContent = perm === 'granted' ? '✅ Notifications enabled' :
                            perm === 'denied'  ? '❌ Notifications blocked (enable in browser settings)' :
                            '⚪ Tap to enable notifications';
    }
  }

  /* ════════════════════════════════════════════
     SETTINGS SCREEN
  ════════════════════════════════════════════ */
  function renderSettings() {
    var nameEl = document.getElementById('settings-name');
    var keyEl  = document.getElementById('settings-apikey');
    if (nameEl) nameEl.value = state.profile.name || '';
    if (keyEl)  keyEl.value  = state.profile.apiKey || '';
  }

  function saveSettings() {
    var nameEl = document.getElementById('settings-name');
    var keyEl  = document.getElementById('settings-apikey');
    if (nameEl) state.profile.name   = nameEl.value.trim();
    if (keyEl)  {
      var key = keyEl.value.trim();
      if (key && !key.startsWith('sk-ant-')) { showToast('API key must start with sk-ant-', 'error'); return; }
      state.profile.apiKey = key;
      if (key) window.SWAvatarApiKey = key;
    }
    saveState();
    renderToday();
    showToast('Settings saved ✓');
  }

  /* ════════════════════════════════════════════
     DELETE HANDLER (delegated)
  ════════════════════════════════════════════ */
  function handleDelete(type, id) {
    var confirmMsg = 'Delete this item?';
    if (!confirm(confirmMsg)) return;
    if (type === 'event')   { state.schedule = state.schedule.filter(function(x){ return x.id !== id; }); if (window.LifeNotif) LifeNotif.cancel('event_' + id); renderSchedule(); }
    if (type === 'legal')   { state.legal    = state.legal.filter(function(x){ return x.id !== id; });    if (window.LifeNotif) LifeNotif.cancel('legal_' + id); renderLegal(); }
    if (type === 'bill')    { state.finance.bills    = (state.finance.bills||[]).filter(function(x){ return x.id !== id; }); if (window.LifeNotif) LifeNotif.cancel('bill_' + id); renderFinance(); }
    if (type === 'expense') { state.finance.expenses = (state.finance.expenses||[]).filter(function(x){ return x.id !== id; }); renderFinance(); }
    if (type === 'maint')   { state.home.maintenance = (state.home.maintenance||[]).filter(function(x){ return x.id !== id; }); renderHome(); }
    if (type === 'repair')  { state.home.repairs     = (state.home.repairs||[]).filter(function(x){ return x.id !== id; }); renderHome(); }
    if (type === 'shift')   { state.work.shifts      = (state.work.shifts||[]).filter(function(x){ return x.id !== id; }); renderWork(); }
    saveState();
    renderToday();
    showToast('Deleted');
  }

  /* ════════════════════════════════════════════
     RENDER DISPATCH
  ════════════════════════════════════════════ */
  function renderScreen(name) {
    if (name === 'today')    renderToday();
    if (name === 'schedule') renderSchedule();
    if (name === 'legal')    renderLegal();
    if (name === 'finance')  renderFinance();
    if (name === 'home')     renderHome();
    if (name === 'work')     renderWork();
    if (name === 'accounts') renderAccounts();
    if (name === 'settings') renderSettings();
  }

  /* ════════════════════════════════════════════
     INIT
  ════════════════════════════════════════════ */
  function init() {
    loadState();

    // Restore API key to avatar widget
    if (state.profile.apiKey) window.SWAvatarApiKey = state.profile.apiKey;

    // Nav buttons
    document.querySelectorAll('.nav-btn').forEach(function(btn) {
      btn.addEventListener('click', function() { showScreen(btn.dataset.screen); });
    });

    // More menu toggle
    var moreBtn = document.getElementById('nav-more-btn');
    var moreMenu = document.getElementById('more-menu');
    if (moreBtn && moreMenu) {
      moreBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        moreMenu.classList.toggle('hidden');
      });
      document.addEventListener('click', function() { closeMoreMenu(); });
    }

    // More menu items
    document.querySelectorAll('.more-item').forEach(function(item) {
      item.addEventListener('click', function() { showScreen(item.dataset.screen); });
    });

    // FAB buttons
    document.querySelectorAll('.fab').forEach(function(fab) {
      fab.addEventListener('click', function() { openModal(fab.dataset.modal); });
    });

    // Modal close
    document.getElementById('modal-overlay').addEventListener('click', function(e) {
      if (e.target === this) closeModal();
    });
    document.querySelectorAll('.modal-close').forEach(function(btn) {
      btn.addEventListener('click', closeModal);
    });

    // Delegated delete + action buttons
    document.addEventListener('click', function(e) {
      var del = e.target.closest('[data-type][data-id].delete-btn');
      if (del) { handleDelete(del.dataset.type, del.dataset.id); return; }

      var action = e.target.closest('[data-action]');
      if (action) {
        var act = action.dataset.action;
        var id  = action.dataset.id;
        if (act === 'pay-bill') {
          var bill = state.finance.bills.find(function(b){ return b.id === id; });
          if (bill) { bill.paid = !bill.paid; saveState(); renderFinance(); renderToday(); }
        }
        if (act === 'done-maint') {
          var m = state.home.maintenance.find(function(x){ return x.id === id; });
          if (m) { m.lastDone = new Date().toISOString().slice(0,10); saveState(); renderHome(); showToast('Marked done'); }
        }
      }
    });

    // Form submits
    setupForms();

    // Notification check
    if (window.LifeNotif) LifeNotif.checkPending();

    // Register SW
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(function(){});
    }

    // Show today
    showScreen('today');
    // Fade in
    setTimeout(function() {
      var splash = document.getElementById('splash');
      if (splash) { splash.style.opacity = '0'; setTimeout(function(){ splash.style.display='none'; }, 400); }
    }, 600);
  }

  /* ════════════════════════════════════════════
     FORM SETUP
  ════════════════════════════════════════════ */
  function setupForms() {
    // Add Event
    var evtForm = document.getElementById('form-add-event');
    if (evtForm) evtForm.addEventListener('submit', function(e) {
      e.preventDefault();
      var d = new FormData(evtForm);
      if (!d.get('title') || !d.get('date')) { showToast('Title and date required', 'error'); return; }
      addEvent({ title: d.get('title'), date: d.get('date'), time: d.get('time'), category: d.get('category') });
      closeModal();
    });

    // Add Legal
    var legForm = document.getElementById('form-add-legal');
    if (legForm) legForm.addEventListener('submit', function(e) {
      e.preventDefault();
      var d = new FormData(legForm);
      if (!d.get('title') || !d.get('dueDate')) { showToast('Title and due date required', 'error'); return; }
      addLegal({ title: d.get('title'), dueDate: d.get('dueDate'), type: d.get('type'), notes: d.get('notes') });
      closeModal();
    });

    // Add Bill
    var billForm = document.getElementById('form-add-bill');
    if (billForm) billForm.addEventListener('submit', function(e) {
      e.preventDefault();
      var d = new FormData(billForm);
      if (!d.get('title') || !d.get('dueDate')) { showToast('Title and due date required', 'error'); return; }
      addBill({ title: d.get('title'), amount: d.get('amount'), dueDate: d.get('dueDate'), recurring: d.get('recurring') === 'on' });
      closeModal();
    });

    // Add Expense
    var expForm = document.getElementById('form-add-expense');
    if (expForm) expForm.addEventListener('submit', function(e) {
      e.preventDefault();
      var d = new FormData(expForm);
      if (!d.get('title') || !d.get('amount')) { showToast('Title and amount required', 'error'); return; }
      addExpense({ title: d.get('title'), amount: d.get('amount'), category: d.get('category'), date: d.get('date') });
      closeModal();
    });

    // Add Maintenance
    var maintForm = document.getElementById('form-add-maint');
    if (maintForm) maintForm.addEventListener('submit', function(e) {
      e.preventDefault();
      var d = new FormData(maintForm);
      if (!d.get('title')) { showToast('Title required', 'error'); return; }
      addMaintenance({ title: d.get('title'), intervalDays: d.get('intervalDays'), lastDone: d.get('lastDone') });
      closeModal();
    });

    // Add Repair
    var repairForm = document.getElementById('form-add-repair');
    if (repairForm) repairForm.addEventListener('submit', function(e) {
      e.preventDefault();
      var d = new FormData(repairForm);
      if (!d.get('title')) { showToast('Title required', 'error'); return; }
      addRepair({ title: d.get('title'), date: d.get('date'), cost: d.get('cost'), notes: d.get('notes') });
      closeModal();
    });

    // Add Shift
    var shiftForm = document.getElementById('form-add-shift');
    if (shiftForm) shiftForm.addEventListener('submit', function(e) {
      e.preventDefault();
      var d = new FormData(shiftForm);
      if (!d.get('date')) { showToast('Date required', 'error'); return; }
      addShift({ date: d.get('date'), startTime: d.get('startTime'), endTime: d.get('endTime'), rate: d.get('rate'), notes: d.get('notes') });
      closeModal();
    });

    // Budget income
    var incomeInput = document.getElementById('budget-income-input');
    if (incomeInput) {
      incomeInput.value = state.finance.budget.income || '';
      incomeInput.addEventListener('change', function() {
        state.finance.budget.income = Number(this.value) || 0;
        saveState(); renderFinance();
      });
    }

    // Settings save
    var settingsBtn = document.getElementById('settings-save-btn');
    if (settingsBtn) settingsBtn.addEventListener('click', saveSettings);

    // Accounts — notification permission
    var notifBtn = document.getElementById('account-notif-btn');
    if (notifBtn && window.LifeNotif) {
      notifBtn.addEventListener('click', async function() {
        var granted = await LifeNotif.request();
        showToast(granted ? 'Notifications enabled ✓' : 'Permission denied — check browser settings');
        renderAccounts();
      });
    }

    // Accounts — Google Calendar
    var calSaveBtn = document.getElementById('account-gcal-save');
    if (calSaveBtn) {
      var calInput = document.getElementById('account-gcal-input');
      if (calInput) calInput.value = state.accounts.googleCal || '';
      calSaveBtn.addEventListener('click', function() {
        state.accounts.googleCal = (calInput && calInput.value.trim()) || '';
        saveState(); renderAccounts();
        showToast('Calendar URL saved');
      });
    }
  }

  // Expose openModal globally (used in inline onclick in today screen)
  window.openModal = openModal;
  window.showScreen = showScreen;

  document.addEventListener('DOMContentLoaded', init);
})();
