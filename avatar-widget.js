/* avatar-widget.js — LifeOS Jedi AI Assistant
 * Q&A guided intake: topic → follow-up → Claude answer
 * Positioned above bottom nav + FABs (no overlap)
 * #ASSUMPTION: --nav-h CSS variable is defined by index.html (60px)
 * #ASSUMPTION: api.anthropic.com/v1/messages SSE format is stable
 */
(function () {
  'use strict';

  /* ── API key ─────────────────────────────────── */
  function getApiKey() {
    if (window.SWAvatarApiKey) return window.SWAvatarApiKey;
    try {
      // Check lifeos_state first
      var s = JSON.parse(localStorage.getItem('lifeos_state') || '{}');
      if (s.profile && s.profile.apiKey && s.profile.apiKey.startsWith('sk-ant-')) return s.profile.apiKey;
      // Scan all keys
      var keys = Object.keys(localStorage);
      for (var i = 0; i < keys.length; i++) {
        var v = localStorage.getItem(keys[i]);
        if (v && v.startsWith('sk-ant-')) return v;
      }
    } catch(e) {}
    return '';
  }

  /* ── Context ─────────────────────────────────── */
  function getCtx() {
    var el = document.getElementById('sw-avatar');
    return (el && el.dataset.context) ? el.dataset.context : 'LifeOS personal life management app';
  }

  /* ── Q&A topic tree ──────────────────────────── */
  var QA_TREE = {
    root: {
      q: 'What do you need help with?',
      opts: ['⚖️ Legal matter', '💰 Bills & budget', '📅 My schedule', '🏡 Home or work']
    },
    '⚖️ Legal matter': {
      q: 'What kind of legal help?',
      opts: ['I have a court date', 'Lease up for renewal', 'Got a notice I don\'t understand', 'What are my rights?']
    },
    '💰 Bills & budget': {
      q: 'What\'s the money question?',
      opts: ['Am I over budget?', 'Bill due soon', 'Help me track spending', 'Explain a charge or fee']
    },
    '📅 My schedule': {
      q: 'What do you need help planning?',
      opts: ['Organize my day', 'Too many deadlines', 'Help me prioritize', 'Need a reminder']
    },
    '🏡 Home or work': {
      q: 'Home or work question?',
      opts: ['Maintenance is overdue', 'Track my work hours', 'Landlord or tenant question', 'Calculate my pay']
    }
  };

  /* ── Jedi greetings ──────────────────────────── */
  var GREETS = [
    'The Force is with you. How can I help?',
    'Ready to assist, young Padawan.',
    'I sense you need guidance. What\'s up?',
    'Your life, I can help organize.',
    'Much to manage there is. Let\'s go.',
  ];
  var _gi = -1;
  function nextGreet() {
    var n; do { n = Math.floor(Math.random() * GREETS.length); } while (n === _gi && GREETS.length > 1);
    _gi = n; return GREETS[n];
  }

  /* ── Demo answers ────────────────────────────── */
  function demoAnswer() {
    return 'Demo mode active — go to ⚙️ Settings and enter your Claude API key (sk-ant-...) to get real answers. May the Force guide you!';
  }

  /* ── Friendly errors ─────────────────────────── */
  function friendlyError(status, msg) {
    if (status === 401) return 'Invalid API key — tap ⚙️ Settings to update it.';
    if (status === 429) return 'Too many requests — wait a moment, then try again.';
    if (status === 529) return 'Claude is overloaded right now — try again shortly.';
    if (status >= 500)  return 'Claude is having a moment — try again in a few seconds.';
    if (msg && msg.includes('timeout')) return 'Request timed out — check your connection.';
    return 'Something went wrong — please try again.';
  }

  /* ── Streaming Claude call ───────────────────── */
  // #ASSUMPTION: browser supports ReadableStream + TextDecoder (all modern browsers)
  async function askStream(question, onChunk, onDone, onError) {
    var apiKey = getApiKey();
    if (!apiKey) { onDone(demoAnswer()); return; }
    if (question.length > 600) question = question.slice(0, 600);

    var sys = 'You are a helpful AI life assistant inside LifeOS, a personal life management app for everyday people — homeowners, workers, renters. Context: '
      + getCtx() + '. Answer in 2-4 sentences. Be direct, practical, plain language. No corporate jargon.';

    var controller = new AbortController();
    var timer = setTimeout(function() { controller.abort(); }, 30000);

    try {
      var res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-calls': 'true'
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5',
          max_tokens: 280,
          stream: true,
          system: sys,
          messages: [{ role: 'user', content: question }]
        })
      });

      clearTimeout(timer);
      if (!res.ok) { onError(friendlyError(res.status, '')); return; }

      var reader  = res.body.getReader();
      var decoder = new TextDecoder();
      var full = '', buf = '';

      while (true) {
        var result = await reader.read();
        if (result.done) break;
        buf += decoder.decode(result.value, { stream: true });
        var lines = buf.split('\n');
        buf = lines.pop();
        for (var i = 0; i < lines.length; i++) {
          var line = lines[i];
          if (!line.startsWith('data: ')) continue;
          var data = line.slice(6).trim();
          if (data === '[DONE]') continue;
          try {
            var parsed = JSON.parse(data);
            if (parsed.type === 'content_block_delta' && parsed.delta && parsed.delta.type === 'text_delta') {
              full += parsed.delta.text;
              onChunk(full);
            }
          } catch(e) {}
        }
      }
      onDone(full || 'No answer returned.');

    } catch(e) {
      clearTimeout(timer);
      if (e.name === 'AbortError') { onError(friendlyError(0, 'timeout')); return; }
      onError(friendlyError(0, 'network'));
    }
  }

  /* ── CSS ─────────────────────────────────────── */
  // Bottom: nav(60) + share-widget-area(50) + gap = 120px from bottom, left side
  var CSS = [
    '.jd{position:fixed;bottom:128px;left:14px;z-index:99999;display:flex;flex-direction:column;align-items:flex-start;gap:8px;font-family:-apple-system,BlinkMacSystemFont,"Inter",sans-serif}',
    '.jd-bubble{background:#0a0e1a;border:1px solid #4fc3f7;border-radius:4px 16px 16px 16px;',
    'color:#e3f2fd;font-size:12px;line-height:1.6;max-width:230px;padding:11px 14px;',
    'word-break:break-word;box-shadow:0 4px 20px rgba(79,195,247,0.2);',
    'animation:jdPop 0.22s cubic-bezier(0.34,1.56,0.64,1)}',
    '.jd-bubble.hidden{display:none}',
    '.jd-bubble.error{border-color:#f44336;color:#ffcdd2}',
    '.jd-opts{display:flex;flex-direction:column;gap:5px;max-width:230px;animation:jdFade 0.2s ease}',
    '.jd-opts.hidden{display:none}',
    '.jd-opt{background:#0a0e1a;border:1px solid rgba(79,195,247,0.45);border-radius:10px;',
    'color:#b3e5fc;font-size:11px;padding:8px 12px;cursor:pointer;text-align:left;',
    'transition:background 0.15s,border-color 0.15s;user-select:none}',
    '.jd-opt:hover{background:rgba(79,195,247,0.12);border-color:#4fc3f7}',
    '.jd-opt:active{transform:scale(0.97)}',
    '.jd-opt.back-btn{color:#546e7a;border-color:rgba(84,110,122,0.3);font-size:10px;padding:5px 10px}',
    '.jd-opt.free-btn{color:#4fc3f7;border-color:rgba(79,195,247,0.3);font-size:10px;padding:5px 10px}',
    '.jd-row{display:flex;align-items:center;gap:7px;background:#0a0e1a;border:1px solid rgba(79,195,247,0.4);',
    'border-radius:24px;padding:6px 6px 6px 13px;width:220px;',
    'box-shadow:0 4px 16px rgba(79,195,247,0.15);animation:jdFade 0.2s ease}',
    '.jd-row.hidden{display:none}',
    '.jd-inp{flex:1;background:transparent;border:none;outline:none;color:#e3f2fd;font-size:11px;',
    'caret-color:#4fc3f7;min-width:0}',
    '.jd-inp::placeholder{color:rgba(179,229,252,0.35)}',
    '.jd-send{width:28px;height:28px;border-radius:50%;background:#4fc3f7;border:none;',
    'color:#0a0e1a;font-size:14px;font-weight:700;cursor:pointer;display:flex;',
    'align-items:center;justify-content:center;flex-shrink:0;transition:transform 0.15s}',
    '.jd-send:active{transform:scale(0.88)}',
    '.jd-send:disabled{background:rgba(79,195,247,0.3);cursor:not-allowed}',
    '.jd-icon{width:48px;height:48px;border-radius:50%;background:#0a0e1a;',
    'border:1.5px solid #4fc3f7;display:flex;align-items:center;justify-content:center;',
    'cursor:pointer;box-shadow:0 0 14px rgba(79,195,247,0.35);',
    'transition:box-shadow 0.2s,transform 0.2s;flex-shrink:0}',
    '.jd-icon:hover{box-shadow:0 0 26px rgba(79,195,247,0.55)}',
    '.jd-icon:active{transform:scale(0.9)}',
    '.jd-icon.open{border-color:#4fc3f7;box-shadow:0 0 26px rgba(79,195,247,0.6)}',
    '.jd-dots{display:inline-flex;gap:3px;align-items:center;padding:2px 0}',
    '.jd-dots span{width:5px;height:5px;border-radius:50%;background:#4fc3f7;animation:jdBounce 1s ease-in-out infinite}',
    '.jd-dots span:nth-child(2){animation-delay:0.15s}.jd-dots span:nth-child(3){animation-delay:0.3s}',
    '@keyframes jdPop{0%{opacity:0;transform:scale(0.85) translateY(8px)}100%{opacity:1;transform:scale(1) translateY(0)}}',
    '@keyframes jdFade{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}',
    '@keyframes jdBounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-5px)}}',
    '@keyframes jdBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}',
    '.jd-icon{animation:jdBob 3s ease-in-out infinite}.jd-icon.open{animation:none}',
  ].join('');

  /* ── SVG droid ───────────────────────────────── */
  var DROID = '<svg width="28" height="34" viewBox="0 0 60 72" fill="none" xmlns="http://www.w3.org/2000/svg">'
    + '<rect x="12" y="28" width="36" height="28" rx="7" fill="#0d1b2a"/>'
    + '<rect x="12" y="28" width="36" height="28" rx="7" fill="url(#a)"/>'
    + '<circle cx="30" cy="42" r="5" fill="#4fc3f7" opacity="0.9"/>'
    + '<circle cx="30" cy="42" r="3" fill="#e3f2fd"/>'
    + '<path d="M12 26 Q12 8 30 8 Q48 8 48 26 Z" fill="#1565c0"/>'
    + '<circle cx="30" cy="18" r="5" fill="#0d1b2a"/>'
    + '<circle cx="30" cy="18" r="3.5" fill="#4fc3f7"/>'
    + '<circle cx="30" cy="18" r="2" fill="#e3f2fd"/>'
    + '<circle cx="28" cy="16.5" r="0.7" fill="white" opacity="0.8"/>'
    + '<line x1="30" y1="8" x2="30" y2="3" stroke="#78909c" stroke-width="1.5"/>'
    + '<circle cx="30" cy="2" r="2" fill="#f44336"/>'
    + '<rect x="6" y="32" width="6" height="14" rx="3" fill="#263238"/>'
    + '<rect x="48" y="32" width="6" height="14" rx="3" fill="#263238"/>'
    + '<defs><linearGradient id="a" x1="12" y1="28" x2="48" y2="56" gradientUnits="userSpaceOnUse">'
    + '<stop offset="0%" stop-color="#1565c0" stop-opacity="0.9"/>'
    + '<stop offset="100%" stop-color="#0d1b2a"/></linearGradient></defs></svg>';

  /* ── Build ───────────────────────────────────── */
  function build() {
    var root = document.getElementById('sw-avatar');
    if (!root) return;

    if (!document.getElementById('jd-css')) {
      var s = document.createElement('style'); s.id = 'jd-css'; s.textContent = CSS;
      document.head.appendChild(s);
    }

    var wrap   = document.createElement('div'); wrap.className = 'jd';
    var bubble = document.createElement('div'); bubble.className = 'jd-bubble hidden';
    bubble.onclick = function() { if (!_loading) { bubble.classList.add('hidden'); bubble.classList.remove('error'); } };

    var opts = document.createElement('div'); opts.className = 'jd-opts hidden';
    var row  = document.createElement('div'); row.className  = 'jd-row hidden';
    var inp  = document.createElement('input'); inp.className = 'jd-inp';
    inp.type = 'text'; inp.placeholder = 'Ask anything…'; inp.maxLength = 500;
    var send = document.createElement('button'); send.className = 'jd-send'; send.textContent = '↑';
    row.appendChild(inp); row.appendChild(send);

    var icon = document.createElement('div'); icon.className = 'jd-icon';
    icon.innerHTML = DROID;

    wrap.appendChild(bubble);
    wrap.appendChild(opts);
    wrap.appendChild(row);
    wrap.appendChild(icon);
    root.appendChild(wrap);

    var isOpen  = false;
    var _loading = false;
    var _trail  = [];

    /* ── Show Q level ─────────────────────── */
    function showLevel(key) {
      var node = QA_TREE[key] || QA_TREE.root;
      setBubble(node.q, false);
      buildOpts(node.opts, key);
    }

    function setBubble(text, isErr) {
      bubble.innerHTML = '';
      var span = document.createElement('span'); span.textContent = text;
      bubble.appendChild(span);
      bubble.classList.remove('hidden');
      bubble.classList.toggle('error', !!isErr);
    }

    function buildOpts(labels, levelKey) {
      opts.innerHTML = '';
      labels.forEach(function(label) {
        var btn = document.createElement('button'); btn.className = 'jd-opt';
        btn.textContent = label;
        btn.onclick = function() {
          if (QA_TREE[label]) {
            // has children → go deeper
            _trail.push(levelKey);
            showLevel(label);
          } else {
            // leaf → build context-rich question and ask Claude
            var parts = [];
            _trail.forEach(function(t) { if (t !== 'root') parts.push(t.replace(/^[^\s]+ /,'')); });
            parts.push(label);
            var fullQ = 'I need help with ' + parts.join(' — ') + '. App context: ' + getCtx();
            submit(fullQ, label);
          }
        };
        opts.appendChild(btn);
      });
      // Back button
      if (_trail.length > 0) {
        var back = document.createElement('button'); back.className = 'jd-opt back-btn';
        back.textContent = '← Back';
        back.onclick = function() {
          var prev = _trail.pop();
          showLevel(prev || 'root');
        };
        opts.appendChild(back);
      }
      // Free-type option
      var free = document.createElement('button'); free.className = 'jd-opt free-btn';
      free.textContent = '✏️ Type my own question';
      free.onclick = function() { opts.classList.add('hidden'); row.classList.remove('hidden'); setTimeout(function(){ inp.focus(); }, 30); };
      opts.appendChild(free);
      opts.classList.remove('hidden');
      row.classList.add('hidden');
    }

    /* ── Loading ──────────────────────────── */
    function setLoading(on) {
      _loading = on;
      send.disabled = on;
      inp.disabled  = on;
      if (on) {
        bubble.innerHTML = '<div class="jd-dots"><span></span><span></span><span></span></div>';
        bubble.classList.remove('hidden', 'error');
        opts.classList.add('hidden');
      }
    }

    /* ── Submit ───────────────────────────── */
    function submit(question, displayLabel) {
      question = (question || inp.value).trim();
      if (!question) return;
      inp.value = '';
      setLoading(true);

      bubble.innerHTML = '';
      var span = document.createElement('span');
      bubble.appendChild(span);
      bubble.classList.remove('hidden');

      askStream(
        question,
        function onChunk(full) { span.textContent = full; bubble.classList.remove('hidden'); },
        function onDone(full) {
          span.textContent = full;
          setLoading(false);
          // Offer follow-up
          setTimeout(function() {
            buildOpts(['Ask another question', '⬅ Main menu'], 'after-answer');
            // patch onclick for these two
            var btns = opts.querySelectorAll('.jd-opt');
            if (btns[0]) btns[0].onclick = function() { opts.classList.add('hidden'); row.classList.remove('hidden'); setTimeout(function(){ inp.focus(); }, 30); };
            if (btns[1]) btns[1].onclick = function() { _trail = []; showLevel('root'); };
          }, 300);
        },
        function onError(msg) {
          setBubble(msg, true);
          setLoading(false);
          setTimeout(function() { _trail = []; showLevel('root'); }, 3500);
        }
      );
    }

    /* ── Open/close ───────────────────────── */
    icon.onclick = function() {
      isOpen = !isOpen;
      icon.classList.toggle('open', isOpen);
      if (isOpen) {
        _trail = [];
        showLevel('root');
        setBubble(nextGreet(), false);
        setTimeout(function() {
          var node = QA_TREE['root'];
          buildOpts(node.opts, 'root');
        }, 800);
      } else {
        opts.classList.add('hidden');
        row.classList.add('hidden');
        bubble.classList.add('hidden');
      }
    };

    send.onclick = function() { submit(inp.value); };
    inp.onkeydown = function(e) { if (e.key === 'Enter' && !send.disabled) submit(inp.value); };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }

  window.JediBot = { ask: function(q, cb) { askStream(q, function(){}, cb, cb); } };

})();
