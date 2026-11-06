/* APEX · מערכת תיאום צילומים · data lives in Google Sheets via Apps Script */
var API = 'https://script.google.com/macros/s/AKfycbw5nzoVbzhuFhNeT6bs1AfmJkUtEf7fptXa9tZV6g22DO4JXXezPRyKpU0j4yzChFm9/exec';
var BOOT = { page: document.body.getAttribute('data-page') };
var AUTH = {};
var $app = document.getElementById('app'), $bar = document.getElementById('bar');

function call(action, payload) {
  return fetch(API, { method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: action, auth: AUTH, payload: payload || {} }) })
    .then(function (r) { return r.json(); }, function () { throw new Error('אין חיבור. נסו שוב'); })
    .then(function (r) {
      if (r && r.ok) return r.data;
      var msg = r ? r.error : 'שגיאה';
      if (msg === 'צריך להתחבר מחדש' && BOOT.page === 'admin') { sstore('apex_adm', null); AUTH = {}; adminLogin(msg); throw new Error(''); }
      throw new Error(msg);
    });
}
var CONF = null, gsiReady = null, tsReady = null;
function getConf() { return CONF ? Promise.resolve(CONF) : call('config').then(function (c) { CONF = c; return c; }); }
function loadScript(src) { return new Promise(function (res, rej) { var s = document.createElement('script'); s.src = src; s.async = true; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); }
/* Sign in with Google: renders the official button into el, calls cb(idToken) */
function gButton(el, cb) {
  if (!el) return;
  getConf().then(function (c) {
    if (!c.googleClientId) return;
    gsiReady = gsiReady || loadScript('https://accounts.google.com/gsi/client');
    return gsiReady.then(function () {
      google.accounts.id.initialize({ client_id: c.googleClientId, callback: function (r) { cb(r.credential); }, ux_mode: 'popup', auto_select: false });
      el.innerHTML = ''; el.classList.remove('hide');
      google.accounts.id.renderButton(el, { theme: 'filled_black', size: 'large', text: 'continue_with', shape: 'rectangular', locale: 'he', width: 280 });
    });
  }).catch(function () {});
}
/* Cloudflare Turnstile bot check on the client form */
function tsRender(el) {
  if (!el || el.getAttribute('data-done')) return;
  getConf().then(function (c) {
    if (!c.turnstileSiteKey) return;
    el.setAttribute('data-done', '1');
    tsReady = tsReady || loadScript('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit');
    return tsReady.then(function () {
      B.ts = ''; B.tsId = turnstile.render(el, { sitekey: c.turnstileSiteKey, theme: 'dark', language: 'he',
        callback: function (t) { B.ts = t; }, 'expired-callback': function () { B.ts = ''; }, 'error-callback': function () { B.ts = ''; } });
    });
  }).catch(function () {});
}
function tsReset() { try { if (window.turnstile && B.tsId !== undefined) { turnstile.reset(B.tsId); B.ts = ''; } } catch (e) {} }
function sstore(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); if (v === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch (e) { return null; } }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function h(html) { $app.innerHTML = html; }
function bar(html) { if (!html) { $bar.classList.add('hide'); $bar.innerHTML = ''; } else { $bar.innerHTML = html; $bar.classList.remove('hide'); } }
function loading() { h('<div class="spin"></div>'); bar(''); }
function store(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem(k) || 'null'); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } }
var DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
function addDays(s, n) { var p = s.split('-').map(Number); return new Date(Date.UTC(p[0], p[1] - 1, p[2] + n)).toISOString().slice(0, 10); }
function dow(s) { var p = s.split('-').map(Number); return new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay(); }
function dm(s) { var p = s.split('-'); return Number(p[2]) + '.' + Number(p[1]); }
function times(a, b, step) { var o = [], m = toM(a), e = toM(b); for (; m <= e; m += step) o.push(hm(m)); return o; }
function toM(t) { var p = t.split(':').map(Number); return p[0] * 60 + p[1]; }
function hm(m) { return ('0' + Math.floor(m / 60)).slice(-2) + ':' + ('0' + m % 60).slice(-2); }
function copy(text, el) {
  var done = function () { var t = el.textContent; el.textContent = 'הועתק ✓'; setTimeout(function () { el.textContent = t; }, 1500); };
  try { navigator.clipboard.writeText(text).then(done, fallback); } catch (e) { fallback(); }
  function fallback() { var i = document.createElement('textarea'); i.value = text; document.body.appendChild(i); i.select(); try { document.execCommand('copy'); } catch (e) {} i.remove(); done(); }
}
function fail(e) { h('<div class="err">' + esc(e.message) + '</div><button class="btn ghost" data-click="reloadPage()">לנסות שוב</button>'); bar(''); }

/* ═════════════════════ CLIENT ═════════════════════ */
var B = { slots: [], date: null, start: null, conf: {} };
function bookInit() {
  if (!document.getElementById('bk-top')) {
    var top = document.createElement('div'); top.id = 'bk-top'; $app.parentNode.insertBefore(top, $app);
    var ts = document.createElement('div'); ts.id = 'bk-ts'; ts.className = 'hide'; ts.style.margin = '6px 0 20px'; $app.parentNode.insertBefore(ts, $app.nextSibling);
  }
  clientTop();
  loading();
  call('bookData').then(function (d) { B.slots = d.slots; B.conf = d.conf; B.date = null; B.start = null; bookRender(); }).catch(fail);
}
function bookRender(errMsg) {
  if (!B.slots.length) {
    h('<h1>קביעת יום צילום</h1><div class="card"><b>כרגע אין מועדים פנויים</b><p class="muted">דברו איתנו ונמצא יחד מועד שמתאים לכם.</p></div>');
    bar(''); return;
  }
  var day = B.slots.filter(function (s) { return s.date === B.date; })[0];
  var html = '<h1>קביעת יום צילום</h1><p class="sub">בחרו יום ושעת התחלה שנוחים לכם. יום צילום נמשך כ ' + esc(B.conf.durationHours) + ' שעות.</p>';
  html += '<h2>1. באיזה יום?</h2><div class="grid">' + B.slots.map(function (s) {
    return '<button class="chip' + (s.date === B.date ? ' on' : '') + '" data-click="pickDate(\'' + s.date + '\')"><span>יום ' + DAYS[dow(s.date)] + '</span><b>' + dm(s.date) + '</b></button>';
  }).join('') + '</div>';
  if (day) {
    html += '<h2>2. באיזו שעה מתחילים?</h2><div class="grid">' + day.starts.map(function (t) {
      return '<button class="chip' + (t === B.start ? ' on' : '') + '" data-click="pickStart(\'' + t + '\')"><b>' + t + '</b><span>עד ' + hm(toM(t) + B.conf.durationHours * 60) + '</span></button>';
    }).join('') + '</div>';
  }
  if (day && B.start) {
    if (!B.form) { var saved = store('apex_client'); B.form = saved || {}; B.remembered = !!saved; }
    var f = B.form;
    html += '<h2>3. פרטים לצילום</h2>' + (B.remembered ? '<p class="muted small" style="margin:-4px 0 10px">מילאנו את הפרטים מהפעם הקודמת. <button class="btn ghost sm" data-click="forgetClient()">זה לא אני</button></p>' : '') + '<div class="card">' +
      '<label>שם העסק *</label><input id="f_business" value="' + esc(f.business) + '">' +
      '<div class="two"><div><label>איש קשר *</label><input id="f_contact" value="' + esc(f.contact) + '"></div>' +
      '<div><label>טלפון *</label><input id="f_phone" type="tel" inputmode="tel" value="' + esc(f.phone) + '"></div></div>' +
      '<label>כתובת הצילום *</label><input id="f_address" placeholder="רחוב, מספר ועיר" value="' + esc(f.address) + '">' +
      '<label>מייל לאישור (לא חובה)</label><input id="f_email" type="email" inputmode="email" value="' + esc(f.email) + '">' +
      '<label>אילו רכבים מצלמים?</label><input id="f_car" placeholder="לדוגמה: מרצדס G63 שחורה, ריינג׳ רובר ספורט" value="' + esc(f.car) + '">' +
      '<label>הערות</label><textarea id="f_notes">' + esc(f.notes) + '</textarea>' +
      '<input id="f_website" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);opacity:0;pointer-events:none"></div>';
    if (errMsg) html += '<div class="err">' + esc(errMsg) + '</div>';
    var tsEl = document.getElementById('bk-ts'); if (tsEl) { tsEl.classList.remove('hide'); tsRender(tsEl); }
    bar('<button class="btn" id="go" data-click="submitBooking()">קביעת הצילום ל' + 'יום ' + DAYS[dow(B.date)] + ' ' + dm(B.date) + ' ב ' + B.start + '</button>');
  } else { bar(''); var tsEl2 = document.getElementById('bk-ts'); if (tsEl2) tsEl2.classList.add('hide'); }
  h(html);
}
function clientTop() {
  var top = document.getElementById('bk-top'); if (!top) return;
  getConf().then(function (c) {
    if (!c.googleClientId) { top.innerHTML = ''; return; }
    if (B.user) {
      top.innerHTML = '<div class="card row" style="justify-content:space-between"><span>מחוברים בתור <b>' + esc(B.user.email) + '</b></span><button class="btn ghost sm" data-click="clientLogout()">התנתקות</button></div>';
    } else {
      top.innerHTML = '<div class="card"><p class="muted small" style="margin:0 0 10px">התחברו עם Google והפרטים שלכם יישמרו לפעם הבאה. לא חובה.</p><div id="gcl"></div></div>';
      gButton(document.getElementById('gcl'), clientGoogle);
    }
  });
}
function clientGoogle(cred) {
  call('clientLogin', { idToken: cred }).then(function (r) {
    B.idToken = cred; B.user = { email: r.email, name: r.name };
    keepForm();
    var f = B.form || {}, pr = r.profile || {};
    ['business', 'contact', 'phone', 'address', 'car'].forEach(function (k) { if (!f[k] && pr[k]) f[k] = pr[k]; });
    if (!f.contact && r.name) f.contact = r.name;
    if (!f.email) f.email = r.email;
    B.form = f; B.remembered = !!r.profile;
    clientTop(); if (B.slots.length) bookRender();
  }).catch(function (e) { alertBox(e.message); });
}
function clientLogout() { B.user = null; B.idToken = null; try { google.accounts.id.disableAutoSelect(); } catch (e) {} clientTop(); }
function keepForm() { if (!document.getElementById('f_business')) return; B.form = {}; ['business', 'contact', 'phone', 'address', 'email', 'car', 'notes', 'website'].forEach(function (k) { B.form[k] = document.getElementById('f_' + k).value; }); }
function pickDate(d) { keepForm(); B.date = d; B.start = null; bookRender(); setTimeout(function () { window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); }, 30); }
function pickStart(t) { keepForm(); B.start = t; bookRender(); setTimeout(function () { var el = document.getElementById('f_business'); el && el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 30); }
function submitBooking() {
  keepForm(); var f = B.form;
  var miss = ['business', 'contact', 'phone', 'address'].filter(function (k) { return !String(f[k] || '').trim(); });
  if (miss.length) return bookRender('נא למלא את כל השדות שמסומנים בכוכבית');
  if (String(f.phone).replace(/\D/g, '').length < 9) return bookRender('מספר הטלפון לא נראה תקין');
  if (CONF && CONF.turnstileSiteKey && !B.ts) return bookRender('רגע, מסיימים אימות אבטחה קצר. נסו שוב בעוד שנייה');
  var btn = document.getElementById('go'); btn.disabled = true; btn.textContent = 'קובעים...';
  call('book', Object.assign({ date: B.date, start: B.start, idToken: B.idToken || '', turnstile: B.ts || '' }, f)).then(function (r) {
    bar(''); var tsEl = document.getElementById('bk-ts'); if (tsEl) tsEl.classList.add('hide'); tsReset();
    var gcal = 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent('צילום עם APEX') +
      '&dates=' + r.date.replace(/-/g, '') + 'T' + r.start.replace(':', '') + '00/' + r.date.replace(/-/g, '') + 'T' + r.end.replace(':', '') + '00&ctz=Asia/Jerusalem&location=' + encodeURIComponent(f.address);
    h('<div class="center"><div class="big-ok">✓</div><h1>הצילום נקבע!</h1><p class="sub">' + esc(r.label) + ' · ' + r.start + ' עד ' + r.end + '<br>' + esc(f.address) + '</p>' +
      '<a class="btn" href="' + gcal + '" target="_blank">הוספה ליומן שלי</a><p class="muted small" style="margin-top:22px">הצלם שלנו יקבל עכשיו את כל הפרטים. אם צריך לשנות משהו, דברו איתנו.</p></div>');
    store('apex_client', { business: f.business, contact: f.contact, phone: f.phone, email: f.email, address: f.address, car: f.car });
    B.form = null;
  }).catch(function (e) {
    tsReset();
    call('bookData').then(function (d) { B.slots = d.slots; if (!B.slots.some(function (s) { return s.date === B.date && s.starts.indexOf(B.start) >= 0; })) B.start = null; bookRender(e.message); })
      .catch(function () { bookRender(e.message); });
  });
}

/* ═════════════════════ TEAM ═════════════════════ */
var T = {};
function teamInit() {
  store('apex_team', null); // old format kept the code on the device
  var ses = store('apex_team_s');
  if (ses) { AUTH = { session: ses }; loading(); return call('teamLogin').then(teamLoaded).catch(function () { store('apex_team_s', null); AUTH = {}; teamNames(); }); }
  teamNames();
}
function teamNames() {
  loading();
  call('teamList').then(function (list) {
    h('<h1>זמינות צלמים</h1><p class="sub">מי אתה?</p><div class="names">' + list.map(function (p) {
      return '<button class="chip" data-click="teamPin(\'' + p.id + '\',\'' + esc(p.name).replace(/'/g, '') + '\')"><b>' + esc(p.name) + '</b></button>';
    }).join('') + '</div><div class="card" style="margin-top:22px"><p class="muted small" style="margin:0 0 10px">או התחברות עם חשבון Google שרשום אצל בר</p><div id="gtm"></div></div>');
    gButton(document.getElementById('gtm'), function (cred) {
      loading();
      call('teamGoogle', { idToken: cred }).then(function (d) { AUTH = { session: d.session }; store('apex_team_s', d.session); teamLoaded(d); })
        .catch(function (e) { teamNames(); setTimeout(function () { alertBox(e.message); }, 400); });
    });
  }).catch(fail);
}
function teamPin(id, name, err) {
  AUTH.id = id;
  h('<h1>היי ' + esc(name) + '</h1><p class="sub">הכנס את הקוד האישי שלך (4 ספרות)</p><div class="card"><input id="pin" class="pin" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off" autocorrect="off" spellcheck="false" name="apx-code-' + Date.now() + '" data-lpignore="true" data-1p-ignore="true"></div>' +
    (err ? '<div class="err">' + esc(err) + '</div>' : '') + '<button class="btn ghost sm" data-click="teamNames()">זה לא אני</button>');
  var el = document.getElementById('pin'), busy = false; el.focus();
  el.oninput = function (e) {
    el.value = el.value.replace(/\D/g, '').slice(0, 4);
    // only real typing logs in; ignore password-manager autofill (no inputType / replacement text)
    if (!e || !e.inputType || e.inputType === 'insertReplacementText') return;
    if (el.value.length === 4 && !busy) { busy = true; AUTH.pin = el.value; loading(); call('teamLogin').then(function (d) { if (d.session) { store('apex_team_s', d.session); AUTH = { session: d.session }; } teamLoaded(d); }).catch(function (e2) { teamPin(id, name, e2.message); }); }
  };
}
function teamLoaded(d, adminPid) {
  T = d; T.days = {}; T.adminPid = adminPid || null;
  d.avail.forEach(function (a) {
    var x = T.days[a.date];
    if (!x) T.days[a.date] = { from: a.from, to: a.to };
    else { if (a.from < x.from) x.from = a.from; if (a.to > x.to) x.to = a.to; }
  });
  T.dirty = false; teamRender();
}
function isFull(x) { return x && x.from === T.conf.dayStart && x.to === T.conf.dayEnd; }
function teamRender(msg) {
  var shootsBy = {}; T.shoots.forEach(function (s) { (shootsBy[s.date] = shootsBy[s.date] || []).push(s); });
  var opts = times(T.conf.dayStart, T.conf.dayEnd, 30);
  var html = T.adminPid
    ? '<div class="row" style="justify-content:space-between"><h1>הזמינות של ' + esc(T.me.name) + '</h1><button class="btn ghost sm" data-click="adminBack()">חזרה לניהול</button></div><p class="sub">אתה עורך את הזמינות בשמו. אל תשכח לשמור.</p>'
    : '<div class="row" style="justify-content:space-between"><h1>היי ' + esc(T.me.name) + '</h1><button class="btn ghost sm" data-click="teamLogout()">יציאה</button></div>' +
    '<p class="sub">סמן באילו ימים ושעות אתה פנוי לצילום. לקוחות יוכלו לקבוע רק בזמנים שסימנת. אל תשכח לשמור.</p>';
  if (msg) html += '<div class="okbox">' + esc(msg) + '</div>';
  if (T.shoots.length) {
    html += '<h2>הצילומים שלי</h2>' + T.shoots.map(shootCard).join('');
    html += '<h2>הזמינות שלי</h2>';
  }
  var start = T.today, end = addDays(T.today, T.horizon);
  var first = addDays(start, -dow(start)); // week starts on Sunday
  for (var w = first; w <= end; w = addDays(w, 7)) {
    html += '<div class="wk"><h3>שבוע ' + dm(w) + ' עד ' + dm(addDays(w, 6)) + '</h3><div class="row"><button class="btn ghost sm" data-click="weekFill(\'' + w + '\')">פנוי כל השבוע</button><button class="btn ghost sm" data-click="weekClear(\'' + w + '\')">נקה</button></div></div><div class="card" style="padding:4px 14px">';
    for (var i = 0; i < 7; i++) {
      var d = addDays(w, i); if (d < start || d > end) continue;
      var x = T.days[d], mode = !x ? 'no' : isFull(x) ? 'full' : 'part';
      html += '<div class="day"><div class="dl">יום ' + DAYS[dow(d)] + '<span>' + dm(d) + '</span></div>' +
        '<div class="seg"><button class="' + (mode === 'no' ? 'on' : '') + '" data-click="setDay(\'' + d + '\',\'no\')">לא פנוי</button><button class="' + (mode === 'full' ? 'on' : '') + '" data-click="setDay(\'' + d + '\',\'full\')">כל היום</button><button class="' + (mode === 'part' ? 'on' : '') + '" data-click="setDay(\'' + d + '\',\'part\')">שעות</button></div>';
      if (mode === 'part') html += '<div class="hours"><select data-change="setHour(\'' + d + '\',\'from\',this.value)">' + opts.map(function (o) { return '<option' + (o === x.from ? ' selected' : '') + '>' + o + '</option>'; }).join('') + '</select> עד ' +
        '<select data-change="setHour(\'' + d + '\',\'to\',this.value)">' + opts.map(function (o) { return '<option' + (o === x.to ? ' selected' : '') + '>' + o + '</option>'; }).join('') + '</select></div>';
      (shootsBy[d] || []).forEach(function (s) { html += '<span class="badge">צילום ' + s.start + ' · ' + esc(s.business) + '</span>'; });
      html += '</div>';
    }
    html += '</div>';
  }
  h(html);
  bar('<button class="btn" id="save" data-click="teamSave()"' + (T.dirty ? '' : ' disabled') + '>' + (T.dirty ? 'שמירת הזמינות' : 'הכל שמור ✓') + '</button>');
}
function setDay(d, m) {
  if (m === 'no') delete T.days[d];
  else if (m === 'full') T.days[d] = { from: T.conf.dayStart, to: T.conf.dayEnd };
  else T.days[d] = T.days[d] && !isFull(T.days[d]) ? T.days[d] : { from: '09:00', to: '17:00' };
  T.dirty = true; var y = window.scrollY; teamRender(); window.scrollTo(0, y);
}
function setHour(d, k, v) { T.days[d][k] = v; T.dirty = true; var b = document.getElementById('save'); b.disabled = false; b.textContent = 'שמירת הזמינות'; }
function weekFill(w) { for (var i = 0; i < 7; i++) { var d = addDays(w, i); if (d >= T.today && dow(d) !== 6) T.days[d] = { from: T.conf.dayStart, to: T.conf.dayEnd }; } T.dirty = true; var y = window.scrollY; teamRender(); window.scrollTo(0, y); }
function weekClear(w) { for (var i = 0; i < 7; i++) delete T.days[addDays(w, i)]; T.dirty = true; var y = window.scrollY; teamRender(); window.scrollTo(0, y); }
function teamSave() {
  var bad = Object.keys(T.days).filter(function (d) { return T.days[d].to <= T.days[d].from; });
  if (bad.length) return alertBox('בחלק מהימים שעת הסיום מוקדמת משעת ההתחלה');
  var b = document.getElementById('save'); b.disabled = true; b.textContent = 'שומר...';
  var days = Object.keys(T.days).map(function (d) { return { date: d, from: T.days[d].from, to: T.days[d].to }; });
  var y = window.scrollY;
  var pid = T.adminPid;
  call(pid ? 'adminSaveAvail' : 'saveAvail', { days: days, photographerId: pid }).then(function (d) { teamLoaded(d, pid); window.scrollTo(0, y); }).catch(function (e) { b.disabled = false; b.textContent = 'שמירת הזמינות'; alertBox(e.message); });
}
function alertBox(m) { var el = document.createElement('div'); el.className = 'err'; el.textContent = m; $app.insertBefore(el, $app.firstChild); window.scrollTo({ top: 0, behavior: 'smooth' }); }
function teamLogout() { store('apex_team', null); store('apex_team_s', null); AUTH = {}; teamNames(); }
function shootCard(s, admin) {
  return '<div class="card shoot"><div class="row" style="justify-content:space-between"><h4>' + esc(s.business) + '</h4><span class="badge">' + esc(s.label) + ' · ' + s.start + ' עד ' + s.end + '</span></div>' +
    '<div class="kv"><div>איש קשר</div><div>' + esc(s.contact) + ' · <a style="color:var(--acc2)" href="tel:' + esc(s.phone) + '">' + esc(s.phone) + '</a></div><div>כתובת</div><div>' + esc(s.address) + '</div>' +
    (s.car ? '<div>רכבים</div><div>' + esc(s.car) + '</div>' : '') + (s.notes ? '<div>הערות</div><div>' + esc(s.notes) + '</div>' : '') + '</div>' +
    '<div class="row"><a class="btn sm ghost" href="' + s.waze + '" target="_blank">Waze</a><a class="btn sm wa" href="' + s.waClient + '" target="_blank">וואטסאפ ללקוח</a>' + (admin || '') + '</div></div>';
}

/* ═════════════════════ ADMIN ═════════════════════ */
var A = { tab: 'shoots' };
function adminInit() {
  var t = sstore('apex_adm');
  if (!t) return adminLogin();
  AUTH = { token: t }; loading();
  call('adminData').then(function (d) { A.d = d; adminRender(); }).catch(function (e) { if (e.message) fail(e); });
}
function adminLogin(err) {
  bar('');
  h('<h1>ניהול צילומים</h1><p class="sub">כניסה מורשית בלבד</p><form class="card" data-submit="adminDoLogin()">' +
    '<label style="margin-top:0" for="apw">סיסמה</label><input id="apw" type="password" autocomplete="current-password">' +
    '<div class="row" style="margin-top:14px"><button class="btn" id="alg">כניסה</button></div></form>' + (err ? '<div class="err">' + esc(err) + '</div>' : '') +
    '<div id="gad" class="hide" style="margin-top:16px"></div>');
  document.getElementById('apw').focus();
  gButton(document.getElementById('gad'), function (cred) {
    loading();
    call('adminGoogle', { idToken: cred }).then(function (r) { sstore('apex_adm', r.token); AUTH = { token: r.token }; adminInit(); }).catch(function (e) { if (e.message) adminLogin(e.message); });
  });
}
function adminDoLogin() {
  var pw = document.getElementById('apw').value, b = document.getElementById('alg'); b.disabled = true; b.textContent = 'בודק...';
  call('adminLogin', { password: pw }).then(function (r) { sstore('apex_adm', r.token); AUTH = { token: r.token }; adminInit(); })
    .catch(function (e) { adminLogin(e.message); });
  return false;
}
function adminLogout() { call('adminLogout').catch(function () {}); sstore('apex_adm', null); AUTH = {}; adminLogin(); }
function adminRender(msg) {
  var d = A.d, tabs = [['shoots', 'צילומים'], ['newbook', 'קביעת צילום'], ['avail', 'זמינות'], ['team', 'צלמים'], ['conf', 'הגדרות']];
  var html = '<div class="row" style="justify-content:space-between"><h1>ניהול צילומים</h1><button class="btn ghost sm" data-click="adminLogout()">יציאה</button></div>' +
    '<div class="card"><label style="margin-top:0">קישור לצלמים</label><div class="linkbox"><input readonly value="' + esc(d.links.team) + '"><button class="btn sm" data-click="copy(\'' + d.links.team + '\',this)">העתקה</button><a class="btn sm wa" target="_blank" href="https://wa.me/?text=' + encodeURIComponent('היי, זה הקישור לסימון הזמינות שלך לצילומים של APEX:\n' + d.links.team) + '">שליחה</a></div>' +
    '<label>קישור ללקוחות</label><div class="linkbox"><input readonly value="' + esc(d.links.book) + '"><button class="btn sm" data-click="copy(\'' + d.links.book + '\',this)">העתקה</button><a class="btn sm wa" target="_blank" href="https://wa.me/?text=' + encodeURIComponent('היי, כאן אפשר לבחור יום ושעה לצילום:\n' + d.links.book) + '">שליחה</a></div>' +
    '<p class="muted small" style="margin:10px 0 0">' + (d.freeDays ? 'כרגע יש ' + d.freeDays + ' ימים עם מועדים פנויים ללקוחות' : 'כרגע אין אף מועד פנוי. בקש מהצלמים לסמן זמינות') + '</p></div>';
  if (msg) html += '<div class="okbox">' + esc(msg) + '</div>';
  html += '<div class="tabs">' + tabs.map(function (t) { return '<button class="' + (A.tab === t[0] ? 'on' : '') + '" data-click="setTab(\'' + t[0] + '\')">' + t[1] + '</button>'; }).join('') + '</div>';
  html += ({ shoots: adminShoots, newbook: adminNewBook, avail: adminAvail, team: adminTeam, conf: adminConf })[A.tab]();
  h(html); bar('');
}
function adminShoots() {
  var d = A.d, up = d.bookings.filter(function (b) { return b.status === 'פעיל' && b.date >= d.today; });
  var rest = d.bookings.filter(function (b) { return up.indexOf(b) < 0; }).reverse();
  var actives = d.team.filter(function (t) { return t.active !== 'לא'; });
  var html = up.length ? '' : '<div class="card muted">אין צילומים קרובים</div>';
  html += up.map(function (b) {
    var sel = '<select style="width:auto;padding:8px;font-size:14px" data-change="reassign(\'' + b.id + '\',this.value)">' + actives.map(function (t) { return '<option value="' + t.id + '"' + (t.id === b.photographerId ? ' selected' : '') + '>📸 ' + esc(t.name) + '</option>'; }).join('') + '</select>';
    return shootCard(b, sel + (b.waPhotographer ? '<a class="btn sm wa" target="_blank" href="' + b.waPhotographer + '">וואטסאפ לצלם</a>' : '') + '<button class="btn sm red" data-click="cancelShoot(\'' + b.id + '\')">ביטול</button>');
  }).join('');
  if (rest.length) html += '<h2>עבר ובוטלו</h2>' + rest.map(function (b) {
    return '<div class="card row" style="justify-content:space-between"><span>' + esc(b.label) + ' · ' + esc(b.business) + ' · ' + esc(b.photographer) + '</span><span class="badge ' + (b.status === 'בוטל' ? 'red' : 'gray') + '">' + (b.status === 'בוטל' ? 'בוטל' : 'עבר') + '</span></div>';
  }).join('');
  return html;
}
function adminAvail() {
  var d = A.d, team = d.team.filter(function (t) { return t.active !== 'לא'; });
  var av = {}, bk = {};
  d.avail.forEach(function (a) { (av[a.photographerId + a.date] = av[a.photographerId + a.date] || []).push(a.from + ' עד ' + a.to); });
  d.bookings.forEach(function (b) { if (b.status === 'פעיל') (bk[b.photographerId + b.date] = bk[b.photographerId + b.date] || []).push(b.start + ' ' + b.business); });
  var html = '<div class="card scroll" style="padding:6px 10px"><table class="av"><tr><th>יום</th>' + team.map(function (t) { return '<th>' + esc(t.name) + '</th>'; }).join('') + '</tr>';
  for (var i = 0; i < 28; i++) {
    var day = addDays(d.today, i);
    html += '<tr><td><b>' + DAYS[dow(day)].slice(0, 3) + '׳</b> ' + dm(day) + '</td>' + team.map(function (t) {
      var k = t.id + day;
      return '<td>' + (bk[k] ? bk[k].map(function (x) { return '<span class="badge">📸 ' + esc(x) + '</span>'; }).join(' ') + ' ' : '') + (av[k] ? '<span style="color:var(--ok)">' + av[k].join(', ') + '</span>' : (bk[k] ? '' : '<span class="muted">·</span>')) + '</td>';
    }).join('') + '</tr>';
  }
  html += '</table></div><h2>עריכת זמינות בשם צלם</h2><div class="row">' + team.map(function (t) {
    return '<button class="btn ghost sm" data-click="adminEditAvail(\'' + t.id + '\')">' + esc(t.name) + '</button>';
  }).join('') + '</div>';
  return html;
}
function adminEditAvail(pid) { loading(); call('adminTeamAvail', { photographerId: pid }).then(function (d) { teamLoaded(d, pid); window.scrollTo(0, 0); }).catch(function (e) { if (e.message) { adminRender(); alertBox(e.message); } }); }
function adminBack() { T = {}; A.tab = 'avail'; adminInit(); }
function adminNewBook() {
  var d = A.d, c = d.conf, act = d.team.filter(function (t) { return t.active !== 'לא'; });
  var opts = times('06:00', '22:00', 30).map(function (o) { return '<option' + (o === '09:00' ? ' selected' : '') + '>' + o + '</option>'; }).join('');
  return '<div class="card"><p class="muted small" style="margin:0 0 6px">קביעה בשם לקוח. אפשר כל תאריך ושעה, גם בלי שהצלם סימן זמינות.</p>' +
    '<div class="two"><div><label>תאריך *</label><input id="nb_date" type="date" min="' + d.today + '" value="' + addDays(d.today, 1) + '"></div>' +
    '<div><label>שעת התחלה *</label><select id="nb_start">' + opts + '</select></div></div>' +
    '<div class="two"><div><label>משך (שעות)</label><input id="nb_dur" inputmode="decimal" value="' + esc(c.durationHours) + '"></div>' +
    '<div><label>צלם</label><select id="nb_ph"><option value="auto">אוטומטי (מי שפנוי לפי הזמינות)</option>' + act.map(function (t) { return '<option value="' + t.id + '">' + esc(t.name) + '</option>'; }).join('') + '</select></div></div>' +
    '<label>שם העסק *</label><input id="nb_business">' +
    '<div class="two"><div><label>איש קשר *</label><input id="nb_contact"></div><div><label>טלפון *</label><input id="nb_phone" type="tel"></div></div>' +
    '<label>כתובת הצילום *</label><input id="nb_address">' +
    '<div class="two"><div><label>מייל הלקוח (לאישור)</label><input id="nb_email" type="email"></div><div><label>רכבים</label><input id="nb_car"></div></div>' +
    '<label>הערות</label><textarea id="nb_notes"></textarea>' +
    '<div class="row" style="margin-top:14px"><button class="btn" data-click="adminDoBook()">קביעת הצילום</button></div></div>';
}
function adminDoBook() {
  var g = function (k) { return document.getElementById('nb_' + k).value.trim(); };
  var p = { date: g('date'), start: g('start'), durationHours: g('dur'), photographerId: g('ph'), business: g('business'), contact: g('contact'),
    phone: g('phone'), address: g('address'), email: g('email'), car: g('car'), notes: g('notes') };
  if (!p.date || !p.business || !p.contact || !p.phone || !p.address) return alertBox('נא למלא את כל השדות שמסומנים בכוכבית');
  loading();
  call('adminBook', p).then(function (r) { A.tab = 'shoots'; return call('adminData').then(function (d) { A.d = d; adminRender('הצילום נקבע: ' + r.label + ' · ' + r.start + ' עד ' + r.end); window.scrollTo(0, 0); }); })
    .catch(function (e) { if (!e.message) return; A.tab = 'newbook'; adminRender(); var m = { dur: 'durationHours', ph: 'photographerId' };
      ['date', 'start', 'dur', 'ph', 'business', 'contact', 'phone', 'address', 'email', 'car', 'notes'].forEach(function (k) { document.getElementById('nb_' + k).value = p[m[k] || k]; }); alertBox(e.message); });
}
function adminTeam() {
  return A.d.team.map(function (t) { return personForm(t); }).join('') + '<h2>הוספת צלם</h2>' + personForm({});
}
function personForm(t) {
  var id = t.id || 'new';
  return '<div class="card"><div class="two"><div><label style="margin-top:0">שם</label><input id="n_' + id + '" value="' + esc(t.name) + '"></div><div><label style="margin-top:0">קוד אישי (4 ספרות)</label><input id="c_' + id + '" inputmode="numeric" maxlength="4" value="' + esc(t.pin) + '"></div></div>' +
    '<div class="two"><div><label>מייל (לשם נשלחות ההתראות)</label><input id="e_' + id + '" type="email" value="' + esc(t.email) + '"></div><div><label>טלפון</label><input id="p_' + id + '" type="tel" value="' + esc(t.phone) + '"></div></div>' +
    '<div class="row" style="margin-top:12px;justify-content:space-between">' + (t.id ? '<label style="margin:0;display:flex;gap:8px;align-items:center;color:var(--txt)"><input id="a_' + id + '" type="checkbox" style="width:auto"' + (t.active !== 'לא' ? ' checked' : '') + '> פעיל</label>' : '<span></span>') +
    '<button class="btn sm" data-click="savePerson(\'' + id + '\')">' + (t.id ? 'שמירה' : 'הוספה') + '</button></div></div>';
}
function adminConf() {
  var c = A.d.conf;
  return '<div class="card"><div class="two"><div><label style="margin-top:0">משך צילום (שעות)</label><input id="k_durationHours" inputmode="decimal" value="' + esc(c.durationHours) + '"></div>' +
    '<div><label style="margin-top:0">מרווח בין צילומים של אותו צלם (דקות)</label><input id="k_bufferMinutes" inputmode="numeric" value="' + esc(c.bufferMinutes) + '"></div></div>' +
    '<div class="two"><div><label>אפשר לקבוע החל מעוד (ימים)</label><input id="k_leadDays" inputmode="numeric" value="' + esc(c.leadDays) + '"></div>' +
    '<div><label>כמה ימים קדימה לקוחות רואים</label><input id="k_horizonDays" inputmode="numeric" value="' + esc(c.horizonDays) + '"></div></div>' +
    '<div class="row" style="margin-top:14px"><button class="btn sm" data-click="saveConf()">שמירה</button></div></div>' +
    '<h2>החלפת סיסמה</h2><div class="card"><div class="two"><div><label style="margin-top:0">סיסמה נוכחית</label><input id="pw_cur" type="password" autocomplete="current-password"></div>' +
    '<div><label style="margin-top:0">סיסמה חדשה (10 תווים לפחות)</label><input id="pw_new" type="password" autocomplete="new-password"></div></div>' +
    '<div class="row" style="margin-top:14px"><button class="btn sm" data-click="changePw()">החלפה</button></div></div>';
}
function adminCall(action, payload, msg) { loading(); call(action, payload).then(function (d) { A.d = d; adminRender(msg); window.scrollTo(0, 0); }).catch(function (e) { if (!e.message) return; adminRender(); alertBox(e.message); }); }
function reassign(id, pid) { var n = A.d.team.filter(function (t) { return t.id === pid; })[0]; if (!confirm('להעביר את הצילום ל' + n.name + '? הוא יקבל התראה')) return adminRender(); adminCall('reassign', { id: id, photographerId: pid }, 'הצילום הועבר ל' + n.name); }
function cancelShoot(id) { if (!confirm('לבטל את הצילום? הצלם יקבל הודעה והמועד ייפתח מחדש')) return; adminCall('cancel', { id: id }, 'הצילום בוטל'); }
function savePerson(id) {
  var g = function (p) { var el = document.getElementById(p + '_' + id); return el ? el.value : ''; };
  var act = document.getElementById('a_' + id);
  adminCall('savePhotographer', { id: id === 'new' ? '' : id, name: g('n'), pin: g('c'), email: g('e'), phone: g('p'), active: act && !act.checked ? 'לא' : 'כן' }, 'נשמר');
}
function changePw() {
  call('adminPassword', { current: document.getElementById('pw_cur').value, next: document.getElementById('pw_new').value })
    .then(function () { adminRender('הסיסמה הוחלפה'); window.scrollTo(0, 0); }).catch(function (e) { alertBox(e.message); });
}
function saveConf() { var p = {}; ['durationHours', 'bufferMinutes', 'leadDays', 'horizonDays'].forEach(function (k) { p[k] = document.getElementById('k_' + k).value.trim(); }); adminCall('saveConf', p, 'ההגדרות נשמרו'); }

/* ═════════════════════ boot ═════════════════════ */
function forgetClient() { store('apex_client', null); B.form = {}; B.remembered = false; bookRender(); }
function setTab(t) { A.tab = t; adminRender(); }
function reloadPage() { location.reload(); }

/* CSP-safe event delegation: data-click="fn('a', this)" / data-change="fn('a', this.value)" */
var ACTS = { pickDate: pickDate, pickStart: pickStart, submitBooking: submitBooking, teamPin: teamPin, teamNames: teamNames, teamLogout: teamLogout,
  setDay: setDay, setHour: setHour, weekFill: weekFill, weekClear: weekClear, teamSave: teamSave, copy: copy, setTab: setTab, reassign: reassign,
  cancelShoot: cancelShoot, forgetClient: forgetClient, clientLogout: clientLogout, adminEditAvail: adminEditAvail, adminBack: adminBack, adminDoBook: adminDoBook, savePerson: savePerson, saveConf: saveConf, changePw: changePw, adminLogout: adminLogout, reloadPage: reloadPage, adminDoLogin: adminDoLogin };
function runAct(el, code) {
  var m = /^(\w+)\(([\s\S]*)\)$/.exec(code || ''); if (!m || !ACTS[m[1]]) return;
  var args = [], re = /'((?:[^'\\]|\\.)*)'|(this\.value)|(this)/g, x;
  while ((x = re.exec(m[2]))) args.push(x[1] !== undefined ? x[1].replace(/\\(.)/g, '$1') : x[2] ? el.value : el);
  ACTS[m[1]].apply(null, args);
}
document.addEventListener('click', function (e) { var el = e.target.closest && e.target.closest('[data-click]'); if (el) runAct(el, el.getAttribute('data-click')); });
document.addEventListener('change', function (e) { var el = e.target.closest && e.target.closest('[data-change]'); if (el) runAct(el, el.getAttribute('data-change')); });
document.addEventListener('submit', function (e) { var el = e.target.closest && e.target.closest('[data-submit]'); if (el) { e.preventDefault(); runAct(el, el.getAttribute('data-submit')); } });

({ book: bookInit, team: teamInit, admin: adminInit })[BOOT.page]();
