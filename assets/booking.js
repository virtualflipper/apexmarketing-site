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
  // manage link from the email: #manage=<id>.<ref> (a hash never reaches servers or logs)
  var mm = /[#&]manage=([a-z0-9]{1,16})\.([A-Za-z0-9_-]{10,40})/.exec(location.hash);
  if (mm) { addRef(mm[1], mm[2]); B.guest = true; try { history.replaceState(null, '', location.pathname); } catch (e) {} }
  loading();
  getConf().then(function (c) {
    var ses = store('apex_client_s');
    if (ses && c.googleClientId) {
      return call('clientMe', { session: ses }).then(function (r) { B.session = ses; B.user = { email: r.email }; applyProfile(r.profile, r.email, ''); loadSlots(); })
        .catch(function () { store('apex_client_s', null); clientWelcome(); });
    }
    if (c.googleClientId && !B.guest) return clientWelcome();
    loadSlots();
  }).catch(fail);
}
function loadSlots() {
  clientTop(); loading(); B.req = false;
  Promise.all([call('bookData'), loadMine()]).then(function (r) { var d = r[0]; B.slots = d.slots; B.conf = d.conf; B.date = null; B.start = null; bookRender(); }).catch(fail);
}
/* my upcoming shoots: by Google login and/or booking references saved on this device */
function myRefs() { var r = store('apex_my_refs'); return Array.isArray(r) ? r : []; }
function addRef(id, tok) { var r = myRefs().filter(function (x) { return x.id !== id; }); r.unshift({ id: id, tok: tok }); store('apex_my_refs', r.slice(0, 20)); }
function loadMine() {
  var refs = myRefs();
  if (!B.session && !refs.length) { B.mine = []; return Promise.resolve(); }
  return call('clientBookings', { session: B.session || '', refs: refs }).then(function (list) { B.mine = list || []; }).catch(function () { B.mine = []; });
}
function mineBlock() {
  if (!B.mine || !B.mine.length) return '';
  return '<h2>הצילומים שלי</h2>' + B.mine.map(function (m) {
    var open = B.cancelOpen === m.id;
    var html = '<div class="card shoot"><div class="row" style="justify-content:space-between"><h4>' + esc(m.business) + '</h4><span class="badge">' + esc(m.label) + ' · ' + m.start + ' עד ' + m.end + '</span></div>' +
      (m.pending ? '<p style="margin:8px 0 0"><span class="badge amber">ממתין לאישור צלם</span></p>' : '') +
      '<div class="kv"><div>כתובת</div><div>' + esc(m.address) + '</div>' + (m.photographer ? '<div>צלם</div><div>' + esc(m.photographer) + '</div>' : '') + '</div>' +
      filesList(m.files) + ((m.files || []).length < FILE_COUNT ? '<div style="margin:0 0 12px">' + filePicker('mineFiles(\'' + m.id + '\',\'' + m.tok + '\',this)', 'הוספת קבצים לצילום').replace(/<p class="muted small"[^]*$/, '') + '</div>' : '');
    if (m.pending) return html + (open
      ? '<div class="cancelbox"><p style="margin:0 0 10px">לבטל את הבקשה? הצלמים לא יראו אותה יותר.</p><div class="row"><button class="btn sm red" data-click="doClientCancel(\'' + m.id + '\',\'' + m.tok + '\')">ביטול הבקשה</button><button class="btn sm ghost" data-click="openCancel(\'\')">חזרה</button></div></div></div>'
      : '<div class="row"><button class="btn sm red" data-click="openCancel(\'' + m.id + '\')">ביטול הבקשה</button></div></div>');
    if (!open) return html + '<div class="row"><button class="btn sm red" data-click="openCancel(\'' + m.id + '\')">ביטול הצילום</button></div></div>';
    return html + '<div class="cancelbox"><label style="margin-top:0">סיבת הביטול (לא חובה)</label><textarea id="cx_reason" maxlength="300"></textarea>' +
      (m.waPhotographer ? '<div class="row" style="margin:12px 0"><a class="btn sm wa" target="_blank" rel="noopener" href="' + esc(m.waPhotographer) + '">וואטסאפ לצלם</a></div>' : '') +
      '<label class="check"><input id="cx_inf" type="checkbox"> עדכנתי את הצלם על הביטול</label>' +
      '<div class="row" style="margin-top:12px"><button class="btn sm red" data-click="doClientCancel(\'' + m.id + '\',\'' + m.tok + '\')">ביטול סופי</button><button class="btn sm ghost" data-click="openCancel(\'\')">חזרה</button></div></div></div>';
  }).join('');
}
function openCancel(id) { keepForm(); B.cancelOpen = id; bookRender(); }
function doClientCancel(id, tok) {
  var pending = id.charAt(0) === 'r', inf = document.getElementById('cx_inf');
  if (!pending && (!inf || !inf.checked)) return alertBox('כדי לבטל צריך לסמן שעדכנתם את הצלם');
  var reason = (document.getElementById('cx_reason') || {}).value || '';
  loading();
  call('clientCancel', { id: id, tok: tok, informed: true, reason: reason }).then(function () {
    B.cancelOpen = null; return loadMine().then(function () { return call('bookData'); });
  }).then(function (d) { B.slots = d.slots; bookRender(); setTimeout(function () { okBox(pending ? 'הבקשה בוטלה' : 'הצילום בוטל. שלחנו עדכון ל APEX'); }, 50); })
    .catch(function (e) { bookRender(); alertBox(e.message); });
}
function okBox(m) { var el = document.createElement('div'); el.className = 'okbox'; el.textContent = m; $app.insertBefore(el, $app.firstChild); window.scrollTo({ top: 0, behavior: 'smooth' }); }
/* first screen: Sign in with Google, or continue as a guest */
function clientWelcome() {
  bar(''); var top = document.getElementById('bk-top'); if (top) top.innerHTML = '';
  h('<h1>קביעת יום צילום</h1><p class="sub">התחברו עם Google והפרטים שלכם יישמרו לפעם הבאה, או המשיכו כאורחים.</p>' +
    '<div class="card center" style="padding:26px 16px"><div id="gcl" style="display:flex;justify-content:center;min-height:44px"></div>' +
    '<div class="muted small" style="margin:18px 0">או</div><button class="btn ghost" data-click="clientGuest()">המשך כאורח</button></div>');
  gButton(document.getElementById('gcl'), clientGoogle);
}
function clientGuest() { B.guest = true; loadSlots(); }
function applyProfile(pr, email, name) {
  keepForm();
  var f = B.form || {}; pr = pr || {};
  ['business', 'contact', 'phone', 'address', 'car'].forEach(function (k) { if (!f[k] && pr[k]) f[k] = pr[k]; });
  if (!f.contact && name) f.contact = name;
  if (!f.email && email) f.email = email;
  B.form = f; B.remembered = !!(pr && pr.business);
}
function bookRender(errMsg) {
  if (B.req) return reqRender(errMsg);
  if (!B.slots.length) {
    h('<h1>קביעת יום צילום</h1>' + mineBlock() + '<div class="card"><b>כרגע אין מועדים פנויים</b><p class="muted">אפשר לבקש תאריך ושעה שנוחים לכם, ונעדכן ברגע שצלם יאשר.</p>' +
      '<button class="btn" data-click="openReq()">בקשת תאריך</button></div>');
    bar(''); var t0 = document.getElementById('bk-ts'); if (t0) t0.classList.add('hide'); return;
  }
  var day = B.slots.filter(function (s) { return s.date === B.date; })[0];
  var html = '<h1>קביעת יום צילום</h1>' + mineBlock() + (B.mine && B.mine.length ? '<h2>צילום חדש</h2>' : '') + '<p class="sub">בחרו יום ושעת התחלה שנוחים לכם. ליד כל שעה רואים עד מתי הצילום יכול להימשך.</p>';
  html += '<h2>1. באיזה יום?</h2><div class="grid">' + B.slots.map(function (s) {
    return '<button class="chip' + (s.date === B.date ? ' on' : '') + '" data-click="pickDate(\'' + s.date + '\')"><span>יום ' + DAYS[dow(s.date)] + '</span><b>' + dm(s.date) + '</b></button>';
  }).join('') + '</div><button class="linkbtn" data-click="openReq()">אף תאריך לא מתאים? בקשו תאריך אחר</button>';
  if (day) {
    html += '<h2>2. באיזו שעה מתחילים?</h2><div class="grid">' + day.starts.map(function (t) {
      return '<button class="chip' + (t === B.start ? ' on' : '') + '" data-click="pickStart(\'' + t + '\')"><b>' + t + '</b><span>עד ' + ((day.ends && day.ends[t]) || hm(toM(t) + B.conf.durationHours * 60)) + '</span></button>';
    }).join('') + '</div>';
  }
  if (day && B.start) {
    html += '<h2>3. פרטים לצילום</h2>' + detailsForm();
    if (errMsg) html += '<div class="err">' + esc(errMsg) + '</div>';
    var tsEl = document.getElementById('bk-ts'); if (tsEl) { tsEl.classList.remove('hide'); tsRender(tsEl); }
    bar('<button class="btn" id="go" data-click="submitBooking()">קביעת הצילום ל' + 'יום ' + DAYS[dow(B.date)] + ' ' + dm(B.date) + ' ב ' + B.start + '</button>');
  } else { bar(''); var tsEl2 = document.getElementById('bk-ts'); if (tsEl2) tsEl2.classList.add('hide'); }
  h(html);
}
/* the client details form, shared by a booking and a date request */
function detailsForm() {
  if (!B.form) { var saved = store('apex_client'); B.form = saved || {}; B.remembered = !!saved; }
  var f = B.form;
  return (B.remembered ? '<p class="muted small" style="margin:-4px 0 10px">מילאנו את הפרטים מהפעם הקודמת. <button class="btn ghost sm" data-click="forgetClient()">זה לא אני</button></p>' : '') + '<div class="card">' +
    '<label>שם העסק *</label><input id="f_business" value="' + esc(f.business) + '">' +
    '<div class="two"><div><label>איש קשר *</label><input id="f_contact" value="' + esc(f.contact) + '"></div>' +
    '<div><label>טלפון *</label><input id="f_phone" type="tel" inputmode="tel" value="' + esc(f.phone) + '"></div></div>' +
    '<label>כתובת הצילום *</label><input id="f_address" placeholder="רחוב, מספר ועיר" value="' + esc(f.address) + '">' +
    '<label>מייל (לאישור ולתזכורת ערב לפני) *</label><input id="f_email" type="email" inputmode="email" autocomplete="email" value="' + esc(f.email) + '">' +
    '<label>אילו רכבים מצלמים?</label><input id="f_car" placeholder="לדוגמה: מרצדס G63 שחורה, ריינג׳ רובר ספורט" value="' + esc(f.car) + '">' +
    '<label>הערות</label><textarea id="f_notes">' + esc(f.notes) + '</textarea>' +
    '<label>קבצים (לא חובה)</label><p class="muted small" style="margin:0 0 8px">דף נתונים של הרכב, מפרט, תמונות או לוגו. ככה נגיע ליום הצילום עם קריאייטיב והוקים מוכנים.</p>' +
    filesList(B.files, 'removeFile') + filePicker('pickFiles(this)') +
    '<input id="f_website" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);opacity:0;pointer-events:none"></div>';
}
/* ───── client files: picked in the form, uploaded one by one right after the booking (or request) is saved */
var FILE_EXT = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'txt'], FILE_MAX = 10 * 1024 * 1024, FILE_COUNT = 8;
function fileSize(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + 'MB' : Math.max(1, Math.round(n / 1024)) + 'KB'; }
function filePicker(handler, label) {
  return '<label class="btn ghost sm filebtn">📎 ' + (label || 'הוספת קבצים') + '<input type="file" multiple accept=".' + FILE_EXT.join(',.') + '" data-change="' + handler + '"></label>' +
    '<p class="muted small" style="margin:6px 0 0">PDF, תמונות, Word או Excel · עד 10MB לקובץ · עד ' + FILE_COUNT + ' קבצים</p>';
}
function filesList(list, removeFn) {
  if (!list || !list.length) return '';
  return '<div class="flist">' + list.map(function (f, i) {
    var name = f.name, size = f.size ? ' <span class="muted small">' + fileSize(f.size) + '</span>' : '';
    var inner = f.url ? '<a href="' + esc(f.url) + '" target="_blank" rel="noopener">📎 ' + esc(name) + '</a>' : '<span>📎 ' + esc(name) + '</span>';
    return '<div>' + inner + size + (removeFn ? '<button class="btn ghost sm" data-click="' + removeFn + '(\'' + i + '\')">הסרה</button>' : '') + '</div>';
  }).join('') + '</div>';
}
/* returns [okFiles, errorText] */
function checkFiles(files, already) {
  var ok = [], bad = [];
  Array.prototype.forEach.call(files, function (f) {
    var ext = (/\.([a-z0-9]{2,5})$/i.exec(f.name) || [])[1];
    if (!ext || FILE_EXT.indexOf(ext.toLowerCase()) < 0) bad.push(f.name + ': סוג קובץ לא נתמך');
    else if (f.size > FILE_MAX) bad.push(f.name + ': גדול מ 10MB');
    else if (already + ok.length >= FILE_COUNT) bad.push(f.name + ': אפשר עד ' + FILE_COUNT + ' קבצים');
    else ok.push(f);
  });
  return [ok, bad.join(' · ')];
}
function formRerender(msg) { var y = window.scrollY; if (B.req) { keepReq(); reqRender(msg); } else bookRender(msg); window.scrollTo(0, y); }
function pickFiles(el) {
  keepForm(); B.files = B.files || [];
  var r = checkFiles(el.files, B.files.length); B.files = B.files.concat(r[0]); el.value = '';
  formRerender(r[1] ? 'לא צירפנו: ' + r[1] : '');
}
function removeFile(i) { keepForm(); B.files.splice(Number(i), 1); formRerender(); }
function readB64(f) {
  return new Promise(function (res, rej) { var fr = new FileReader(); fr.onload = function () { res(String(fr.result).split(',')[1] || ''); }; fr.onerror = function () { rej(new Error('לא הצלחנו לקרוא את הקובץ')); }; fr.readAsDataURL(f); });
}
/* uploads sequentially; progress(i, n) before each; resolves with the list of failures */
function uploadFiles(id, tok, files, progress) {
  var failed = [], done = 0, i = 0;
  function next() {
    if (i >= files.length) return done ? call('filesDone', { id: id, tok: tok }).catch(function () {}).then(function () { return failed; }) : Promise.resolve(failed);
    var f = files[i++]; if (progress) progress(i, files.length, f.name);
    return readB64(f).then(function (b64) { return call('uploadFile', { id: id, tok: tok, name: f.name, data: b64 }); })
      .then(function () { done++; }, function (e) { failed.push(f.name + ': ' + (e.message || 'שגיאה')); }).then(next);
  }
  return next();
}
function uploadProgress(i, n, name) {
  h('<div class="center"><div class="spin"></div><h2>מעלים קבצים ' + i + ' מתוך ' + n + '</h2><p class="muted">' + esc(name) + '</p><p class="muted small">אל תסגרו את הדף</p></div>');
}
/* after a booking or request is saved: upload the picked files, then show the success screen */
function afterSave(r, done) {
  var files = (B.files || []).slice(); B.files = [];
  if (!files.length) return done([]);
  uploadFiles(r.id, r.tok, files, uploadProgress).then(done);
}
function failedNote(failed) {
  return failed.length ? '<div class="err" style="text-align:right">חלק מהקבצים לא עלו: ' + esc(failed.join(' · ')) + '<br>אפשר להעלות אותם שוב מ"הצילומים שלי".</div>' : '';
}
/* add files to an existing booking or request from "my shoots" */
function mineFiles(id, tok, el) {
  var m = (B.mine || []).filter(function (x) { return x.id === id; })[0];
  var r = checkFiles(el.files, m && m.files ? m.files.length : 0); el.value = '';
  if (!r[0].length) return alertBox(r[1]);
  keepForm();
  uploadFiles(id, tok, r[0], uploadProgress).then(function (failed) {
    return loadMine().then(function () {
      B.req = false; bookRender();
      var msg = [r[1]].concat(failed).filter(Boolean).join(' · ');
      if (msg) alertBox('חלק מהקבצים לא עלו: ' + msg); else okBox('הקבצים עלו. תודה!');
    });
  });
}
function formProblem(f) {
  var miss = ['business', 'contact', 'phone', 'address', 'email'].filter(function (k) { return !String(f[k] || '').trim(); });
  if (miss.length) return 'נא למלא את כל השדות שמסומנים בכוכבית';
  if (String(f.phone).replace(/\D/g, '').length < 9) return 'מספר הטלפון לא נראה תקין';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(String(f.email).trim())) return 'כתובת המייל לא נראית תקינה';
  if (CONF && CONF.turnstileSiteKey && !B.ts) return 'רגע, מסיימים אימות אבטחה קצר. נסו שוב בעוד שנייה';
  return '';
}

/* ───── a date nobody marked as free: the client asks, photographers get an email, the first who can takes it */
function openReq() {
  keepForm(); B.req = true; B.cancelOpen = null;
  if (!B.reqDate) B.reqDate = B.date || addDays(todayStr(), Math.max(1, Number(B.conf.leadDays) || 1));
  if (!B.reqStart) B.reqStart = '09:00';
  reqRender(); window.scrollTo(0, 0);
}
function closeReq() { keepReq(); keepForm(); B.req = false; bookRender(); window.scrollTo(0, 0); }
function todayStr() { var d = new Date(), p = function (n) { return ('0' + n).slice(-2); }; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); }
function keepReq() { var a = document.getElementById('rq_date'), b = document.getElementById('rq_start'); if (a) B.reqDate = a.value; if (b) B.reqStart = b.value; }
function reqRender(errMsg) {
  var dur = Number(B.conf.durationHours) || 7, lead = Math.max(1, Number(B.conf.leadDays) || 1);
  var min = addDays(todayStr(), lead), max = addDays(todayStr(), 180);
  var opts = times('06:00', hm(Math.min(24 * 60 - dur * 60, toM('15:00'))), 30).map(function (t) { return '<option value="' + t + '"' + (t === B.reqStart ? ' selected' : '') + '>' + t + ' עד ' + hm(toM(t) + dur * 60) + '</option>'; }).join('');
  var html = '<h1>בקשת תאריך</h1><p class="sub">בחרו תאריך ושעה שנוחים לכם. נשלח את הבקשה לצלמים שלנו, וברגע שצלם יאשר תקבלו מייל עם כל הפרטים.</p>' +
    '<div class="card"><div class="two"><div><label style="margin-top:0">תאריך *</label><input id="rq_date" type="date" min="' + min + '" max="' + max + '" value="' + esc(B.reqDate) + '"></div>' +
    '<div><label style="margin-top:0">שעות *</label><select id="rq_start">' + opts + '</select></div></div></div>' +
    '<h2>פרטים לצילום</h2>' + detailsForm() + (errMsg ? '<div class="err">' + esc(errMsg) + '</div>' : '') +
    '<button class="linkbtn" data-click="closeReq()">חזרה למועדים הפנויים</button>';
  h(html);
  var tsEl = document.getElementById('bk-ts'); if (tsEl) { tsEl.classList.remove('hide'); tsRender(tsEl); }
  bar('<button class="btn" id="go" data-click="submitReq()">שליחת הבקשה</button>');
}
function submitReq() {
  keepReq(); keepForm(); var f = B.form;
  if (!B.reqDate) return reqRender('בחרו תאריך');
  var dur = Number(B.conf.durationHours) || 7, lead = Math.max(1, Number(B.conf.leadDays) || 1);
  if (B.reqDate < addDays(todayStr(), lead)) return reqRender('אפשר לבקש תאריך החל מ ' + dm(addDays(todayStr(), lead)));
  var bad = formProblem(f); if (bad) return reqRender(bad);
  var btn = document.getElementById('go'); btn.disabled = true; btn.textContent = 'שולחים...';
  call('requestDate', Object.assign({ date: B.reqDate, start: B.reqStart, idToken: B.session ? '' : (B.idToken || ''), session: B.session || '', turnstile: B.ts || '' }, f)).then(function (r) {
    bar(''); var tsEl = document.getElementById('bk-ts'); if (tsEl) tsEl.classList.add('hide'); tsReset();
    if (r.id && r.tok) addRef(r.id, r.tok);
    afterSave(r, function (failed) {
    h('<div class="center"><div class="big-ok">✓</div><h1>הבקשה נשלחה!</h1><p class="sub">' + esc(r.label) + ' · ' + r.start + ' עד ' + r.end + '<br>' + esc(f.address) + '</p>' +
      '<p>שלחנו את הבקשה לצלמים שלנו. ברגע שצלם יאשר, נשלח לכם מייל עם כל הפרטים.</p><button class="btn ghost" data-click="backHome()">הצילומים והבקשות שלי</button>' + failedNote(failed) + '</div>');
    store('apex_client', { business: f.business, contact: f.contact, phone: f.phone, email: f.email, address: f.address, car: f.car });
    B.form = null; B.req = false; B.reqDate = null; loadMine();
    });
  }).catch(function (e) { tsReset(); reqRender(e.message); });
}
function backHome() { B.req = false; loadSlots(); }

function clientTop() {
  var top = document.getElementById('bk-top'); if (!top) return;
  getConf().then(function (c) {
    if (!c.googleClientId) { top.innerHTML = ''; return; }
    top.innerHTML = B.user
      ? '<div class="card row" style="justify-content:space-between"><span>מחוברים בתור <b>' + esc(B.user.email) + '</b></span><button class="btn ghost sm" data-click="clientLogout()">התנתקות</button></div>'
      : '<div class="row" style="justify-content:flex-end;margin-bottom:6px"><button class="btn ghost sm" data-click="clientToGoogle()">התחברות עם Google</button></div>';
  });
}
function clientGoogle(cred) {
  loading();
  call('clientLogin', { idToken: cred }).then(function (r) {
    B.idToken = cred; B.session = r.session; B.user = { email: r.email, name: r.name };
    if (r.session) store('apex_client_s', r.session);
    applyProfile(r.profile, r.email, r.name);
    loadSlots();
  }).catch(function (e) { clientWelcome(); setTimeout(function () { alertBox(e.message); }, 300); });
}
/* sign out: forget this person on this device (login, saved details, saved booking links) and go back to the first screen */
function clientLogout() {
  store('apex_client_s', null); store('apex_client', null); store('apex_my_refs', null);
  B.user = null; B.idToken = null; B.session = null; B.guest = false; B.form = null; B.remembered = false; B.mine = [];
  try { google.accounts.id.disableAutoSelect(); } catch (e) {}
  var ts = document.getElementById('bk-ts'); if (ts) ts.classList.add('hide');
  clientWelcome(); okBox('התנתקת. הפרטים שלך נמחקו מהמכשיר הזה');
}
/* a guest who wants to sign in with Google instead: back to the first screen, nothing is deleted */
function clientToGoogle() {
  B.guest = false; B.form = null; B.remembered = false;
  var ts = document.getElementById('bk-ts'); if (ts) ts.classList.add('hide');
  clientWelcome();
}
function keepForm() { if (!document.getElementById('f_business')) return; B.form = {}; ['business', 'contact', 'phone', 'address', 'email', 'car', 'notes', 'website'].forEach(function (k) { B.form[k] = document.getElementById('f_' + k).value; }); }
function pickDate(d) { keepForm(); B.date = d; B.start = null; bookRender(); setTimeout(function () { window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); }, 30); }
function pickStart(t) { keepForm(); B.start = t; bookRender(); setTimeout(function () { var el = document.getElementById('f_business'); el && el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 30); }
function submitBooking() {
  keepForm(); var f = B.form;
  var bad = formProblem(f); if (bad) return bookRender(bad);
  var btn = document.getElementById('go'); btn.disabled = true; btn.textContent = 'קובעים...';
  call('book', Object.assign({ date: B.date, start: B.start, idToken: B.session ? '' : (B.idToken || ''), session: B.session || '', turnstile: B.ts || '' }, f)).then(function (r) {
    bar(''); var tsEl = document.getElementById('bk-ts'); if (tsEl) tsEl.classList.add('hide'); tsReset();
    if (r.id && r.tok) addRef(r.id, r.tok);
    afterSave(r, function (failed) {
    var gcal = 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent('צילום עם APEX') +
      '&dates=' + r.date.replace(/-/g, '') + 'T' + r.start.replace(':', '') + '00/' + r.date.replace(/-/g, '') + 'T' + r.end.replace(':', '') + '00&ctz=Asia/Jerusalem&location=' + encodeURIComponent(f.address);
    h('<div class="center"><div class="big-ok">✓</div><h1>הצילום נקבע!</h1><p class="sub">' + esc(r.label) + ' · ' + r.start + ' עד ' + r.end + '<br>' + esc(f.address) + '</p>' +
      '<a class="btn" href="' + gcal + '" target="_blank" rel="noopener">הוספה ליומן שלי</a> <button class="btn ghost" data-click="backHome()">הצילומים שלי</button>' + failedNote(failed) + '<p class="muted small" style="margin-top:22px">שלחנו אישור למייל. ערב לפני הצילום, בסביבות 19:00, תגיע תזכורת. אם צריך לבטל, אפשר דרך "הצילומים שלי".</p></div>');
    store('apex_client', { business: f.business, contact: f.contact, phone: f.phone, email: f.email, address: f.address, car: f.car });
    B.form = null; loadMine();
    });
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
  if (ses) { AUTH = { session: ses }; loading(); return call('teamLogin').then(teamLoaded).catch(function () { store('apex_team_s', null); AUTH = {}; teamWelcome(); }); }
  teamWelcome();
}
/* first screen: Sign in with Google, or continue with name + personal code */
function teamWelcome() {
  loading();
  getConf().then(function (c) {
    if (!c.googleClientId) return teamNames();
    h('<h1>זמינות צלמים</h1><p class="sub">התחבר עם חשבון ה Google שרשום אצל בר, או המשך עם הקוד האישי שלך.</p>' +
      '<div class="card center" style="padding:26px 16px"><div id="gtm" style="display:flex;justify-content:center;min-height:44px"></div>' +
      '<div class="muted small" style="margin:18px 0">או</div><button class="btn ghost" data-click="teamNames()">המשך עם קוד אישי</button></div>');
    gButton(document.getElementById('gtm'), function (cred) {
      loading();
      call('teamGoogle', { idToken: cred }).then(function (d) { AUTH = { session: d.session }; store('apex_team_s', d.session); teamLoaded(d); })
        .catch(function (e) { teamWelcome(); setTimeout(function () { alertBox(e.message); }, 400); });
    });
  }).catch(fail);
}
function teamNames() {
  loading();
  call('teamList').then(function (list) {
    h('<h1>זמינות צלמים</h1><p class="sub">מי אתה?</p><div class="names">' + list.map(function (p) {
      return '<button class="chip" data-click="teamPin(\'' + esc(p.id) + '\',\'' + esc(String(p.name).replace(/['\\]/g, '')) + '\')"><b>' + esc(p.name) + '</b></button>';
    }).join('') + '</div>' + (CONF && CONF.googleClientId ? '<button class="btn ghost sm" style="margin-top:18px" data-click="teamWelcome()">חזרה להתחברות עם Google</button>' : ''));
  }).catch(fail);
}
function teamPin(id, name, err) {
  AUTH.id = id;
  h('<h1>היי ' + esc(name) + '</h1><p class="sub">הכנס את הקוד האישי שלך</p><div class="card"><input id="pin" class="pin" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="off" autocorrect="off" spellcheck="false" name="apx-code-' + Date.now() + '" data-lpignore="true" data-1p-ignore="true">' +
    '<button class="btn" id="pin_go" style="width:100%;margin-top:12px" disabled>כניסה</button></div>' +
    (err ? '<div class="err">' + esc(err) + '</div>' : '') + '<button class="btn ghost sm" data-click="teamNames()">זה לא אני</button>');
  var el = document.getElementById('pin'), go = document.getElementById('pin_go'), busy = false, typed = false; el.focus();
  function send() {
    if (busy || !typed || el.value.length < 4) return;
    busy = true; AUTH.pin = el.value; loading();
    call('teamLogin').then(function (d) { if (d.session) { store('apex_team_s', d.session); AUTH = { session: d.session }; } teamLoaded(d); }).catch(function (e2) { teamPin(id, name, e2.message); });
  }
  el.oninput = function (e) {
    el.value = el.value.replace(/\D/g, '').slice(0, 6);
    // only real typing logs in; ignore password-manager autofill (no inputType / replacement text)
    typed = !!(e && e.inputType && e.inputType !== 'insertReplacementText');
    go.disabled = !typed || el.value.length < 4;
    if (typed && el.value.length === 6) send();
  };
  el.onkeydown = function (e) { if (e.key === 'Enter') send(); };
  go.onclick = send;
}
function teamLoaded(d, adminPid) {
  var keepMonth = T && T.me && d.me && T.me.id === d.me.id ? T.month : null;
  T = d; T.days = {}; T.adminPid = adminPid || null; T.sel = {}; T.from = '09:00'; T.to = '17:00';
  d.avail.forEach(function (a) {
    var x = T.days[a.date];
    if (!x) T.days[a.date] = { from: a.from, to: a.to };
    else { if (a.from < x.from) x.from = a.from; if (a.to > x.to) x.to = a.to; }
  });
  T.month = keepMonth || d.today.slice(0, 7);
  T.dirty = false; teamRender();
  if (REQ_HASH && !adminPid) {
    var id = REQ_HASH; REQ_HASH = null;
    if ((T.requests || []).some(function (r) { return r.id === id; })) {
      T.hl = id; teamRender();
      setTimeout(function () { var el = document.getElementById('rq_' + id); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 60);
    } else alertBox('הבקשה הזאת כבר נלקחה או נסגרה');
  }
}
function isFull(x) { return x && x.from === T.conf.dayStart && x.to === T.conf.dayEnd; }
function teamRender(msg) {
  var html = T.adminPid
    ? '<div class="row" style="justify-content:space-between"><h1>הזמינות של ' + esc(T.me.name) + '</h1><button class="btn ghost sm" data-click="adminBack()">חזרה לניהול</button></div><p class="sub">אתה עורך את הזמינות בשמו. אל תשכח לשמור.</p>'
    : '<div class="row" style="justify-content:space-between"><h1>היי ' + esc(T.me.name) + '</h1><button class="btn ghost sm" data-click="teamLogout()">התנתקות</button></div>' +
    '<p class="sub">בחר בלוח את הימים שאתה פנוי בהם וסמן שעות. לקוחות יוכלו לקבוע רק בזמנים שסימנת. אל תשכח לשמור.</p>';
  if (msg) html += '<div class="okbox">' + esc(msg) + '</div>';
  if (!T.adminPid && T.requests && T.requests.length) html += '<h2>בקשות פתוחות מלקוחות</h2><p class="muted small" style="margin:-6px 0 10px">לקוחות שביקשו תאריך שעוד לא סומן כפנוי. הראשון שמאשר מקבל את הצילום.</p>' + T.requests.map(reqCard).join('');
  if (T.shoots.length) html += '<h2>הצילומים שלי</h2>' + T.shoots.map(function (s) { return T.adminPid ? shootCard(s) : teamShootCard(s); }).join('');
  html += '<h2>הזמינות שלי</h2>' + calendarHtml() + calPanel();
  h(html);
  bar('<button class="btn" id="save" data-click="teamSave()"' + (T.dirty ? '' : ' disabled') + '>' + (T.dirty ? 'שמירת הזמינות' : 'הכל שמור ✓') + '</button>');
}

/* ───── open client requests: first photographer who can takes it */
var REQ_HASH = (/[#&]req=(r[0-9a-f]{1,16})/.exec(location.hash) || [])[1] || null;
if (REQ_HASH) { try { history.replaceState(null, '', location.pathname); } catch (e) {} }
function reqCard(r) {
  var html = '<div class="card shoot req' + (T.hl === r.id ? ' hl' : '') + '" id="rq_' + esc(r.id) + '"><div class="row" style="justify-content:space-between"><h4>' + esc(r.business) + '</h4><span class="badge">' + esc(r.label) + ' · ' + r.start + ' עד ' + r.end + '</span></div>' +
    '<div class="kv"><div>כתובת</div><div>' + esc(r.address) + '</div>' + (r.car ? '<div>רכבים</div><div>' + esc(r.car) + '</div>' : '') + (r.notes ? '<div>הערות</div><div>' + esc(r.notes) + '</div>' : '') +
    (r.files ? '<div>קבצים</div><div>📎 ' + r.files + ' קבצים מהלקוח, נפתחים אחרי שלוקחים את הצילום</div>' : '') + '</div>';
  if (r.busy) return html + '<p class="muted small" style="margin:0">יש לך כבר צילום באותו זמן</p></div>';
  if (T.takeOpen === r.id) return html + '<div class="cancelbox"><p style="margin:0 0 10px">לקחת את הצילום ב' + esc(r.label) + ', ' + r.start + ' עד ' + r.end + '? הלקוח יקבל אישור, ואתה תקבל את כל הפרטים שלו.</p>' +
    '<div class="row"><button class="btn sm" data-click="doTake(\'' + esc(r.id) + '\')">כן, הצילום שלי</button><button class="btn sm ghost" data-click="openTake(\'\')">חזרה</button></div></div></div>';
  return html + '<div class="row"><button class="btn sm" data-click="openTake(\'' + esc(r.id) + '\')">אני יכול לצלם</button></div></div>';
}
function openTake(id) { T.takeOpen = id; var y = window.scrollY; teamRender(); window.scrollTo(0, y); }
function doTake(id) {
  if (T.dirty && !confirm('יש שינויים בזמינות שלא נשמרו. להמשיך בלי לשמור אותם?')) return;
  loading();
  call('teamTake', { id: id }).then(function (d) { teamLoaded(d); setTimeout(function () { okBox('הצילום שלך! כל הפרטים ב"הצילומים שלי" ונשלחו גם למייל'); }, 50); })
    .catch(function (e) { call('teamLogin').then(function (d) { teamLoaded(d); alertBox(e.message); }).catch(function () { teamRender(); alertBox(e.message); }); });
}

/* ───── availability calendar: tap days, pick hours, apply */
var WD = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
var MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
function monthDays(ym) { var p = ym.split('-').map(Number), n = new Date(Date.UTC(p[0], p[1], 0)).getUTCDate(), out = []; for (var i = 1; i <= n; i++) out.push(ym + '-' + ('0' + i).slice(-2)); return out; }
function shiftMonth(ym, k) { var p = ym.split('-').map(Number); return new Date(Date.UTC(p[0], p[1] - 1 + k, 1)).toISOString().slice(0, 7); }
function shortT(t) { var p = t.split(':'); return Number(p[0]) + (p[1] !== '00' ? ':' + p[1] : ''); }
function lastDay() { return addDays(T.today, T.horizon); }
function inRange(d) { return d >= T.today && d <= lastDay(); }
function calendarHtml() {
  var ym = T.month, days = monthDays(ym), p = ym.split('-').map(Number);
  var shootsBy = {}; T.shoots.forEach(function (s) { shootsBy[s.date] = 1; });
  var canPrev = ym > T.today.slice(0, 7), canNext = ym < lastDay().slice(0, 7);
  var html = '<div class="card cal"><div class="calhd"><button class="btn ghost sm" aria-label="החודש הקודם" data-click="calNav(\'-1\')"' + (canPrev ? '' : ' disabled') + '>›</button>' +
    '<b>' + MONTHS[p[1] - 1] + ' ' + p[0] + '</b><button class="btn ghost sm" aria-label="החודש הבא" data-click="calNav(\'1\')"' + (canNext ? '' : ' disabled') + '>‹</button></div><div class="calgrid">';
  html += WD.map(function (w, i) { return '<button class="wd" title="כל ימי ' + DAYS[i] + ' בחודש" data-click="calWeekday(\'' + i + '\')">' + w + '</button>'; }).join('');
  for (var i = 0; i < dow(days[0]); i++) html += '<div class="cd blank"></div>';
  days.forEach(function (d) {
    var x = T.days[d], ok = inRange(d);
    var cls = 'cd' + (ok ? '' : ' off') + (x && ok ? ' av' : '') + (T.sel[d] ? ' sel' : '') + (d === T.today ? ' today' : '');
    html += '<button class="' + cls + '"' + (ok ? ' data-click="calTap(\'' + d + '\')"' : ' disabled') + '><b>' + Number(d.slice(8)) + '</b>' +
      (x && ok ? '<small>' + (isFull(x) ? 'כל היום' : shortT(x.from) + ' עד ' + shortT(x.to)) + '</small>' : '') + (shootsBy[d] ? '<i>📸</i>' : '') + '</button>';
  });
  return html + '</div><div class="legend"><span class="l-av">פנוי</span><span class="l-sel">נבחר</span><span>📸 יש צילום</span></div></div>';
}
function calPanel() {
  var sel = Object.keys(T.sel).sort(), opts = times(T.conf.dayStart, T.conf.dayEnd, 30);
  if (!sel.length) return '<div class="card calpanel"><p class="muted" style="margin:0">לחץ על ימים בלוח כדי לבחור אותם, ואז סמן שעות. לחיצה על א׳ עד ש׳ בוחרת את כל הימים האלה בחודש.</p>' +
    '<div class="row" style="margin-top:12px"><button class="btn ghost sm" data-click="calMonthAll()">בחירת כל החודש חוץ משבת</button></div></div>';
  var o = function (v) { return opts.map(function (t) { return '<option' + (t === v ? ' selected' : '') + '>' + t + '</option>'; }).join(''); };
  return '<div class="card calpanel on"><div class="row" style="justify-content:space-between;margin-bottom:10px"><b>' + (sel.length === 1 ? 'נבחר יום ' + DAYS[dow(sel[0])] + ' ' + dm(sel[0]) : 'נבחרו ' + sel.length + ' ימים') + '</b>' +
    '<button class="btn ghost sm" data-click="calClear()">ניקוי בחירה</button></div>' +
    '<div class="hours"><span class="muted">משעה</span><select data-change="calHour(\'from\',this.value)">' + o(T.from) + '</select><span class="muted">עד</span><select data-change="calHour(\'to\',this.value)">' + o(T.to) + '</select></div>' +
    '<div class="row" style="margin-top:12px"><button class="btn sm" data-click="calApply(\'part\')">פנוי בשעות האלה</button><button class="btn sm ghost" data-click="calApply(\'full\')">פנוי כל היום</button><button class="btn sm red" data-click="calApply(\'no\')">לא פנוי</button></div></div>';
}
function calRerender() { var y = window.scrollY; teamRender(); window.scrollTo(0, y); }
function calNav(k) { T.month = shiftMonth(T.month, Number(k)); calRerender(); }
function calTap(d) {
  if (T.sel[d]) delete T.sel[d]; else T.sel[d] = 1;
  var k = Object.keys(T.sel);
  if (k.length === 1 && T.days[k[0]] && !isFull(T.days[k[0]])) { T.from = T.days[k[0]].from; T.to = T.days[k[0]].to; }
  calRerender();
}
function calWeekday(i) {
  var list = monthDays(T.month).filter(function (d) { return dow(d) === Number(i) && inRange(d); });
  var all = list.length && list.every(function (d) { return T.sel[d]; });
  list.forEach(function (d) { if (all) delete T.sel[d]; else T.sel[d] = 1; });
  calRerender();
}
function calMonthAll() { monthDays(T.month).forEach(function (d) { if (inRange(d) && dow(d) !== 6) T.sel[d] = 1; }); calRerender(); }
function calClear() { T.sel = {}; calRerender(); }
function calHour(k, v) { T[k] = v; }
function calApply(mode) {
  if (mode === 'part' && toM(T.to) <= toM(T.from)) return alertBox('שעת הסיום צריכה להיות אחרי שעת ההתחלה');
  Object.keys(T.sel).forEach(function (d) {
    if (mode === 'no') delete T.days[d];
    else if (mode === 'full') T.days[d] = { from: T.conf.dayStart, to: T.conf.dayEnd };
    else T.days[d] = { from: T.from, to: T.to };
  });
  T.sel = {}; T.dirty = true; calRerender();
}
window.addEventListener('beforeunload', function (e) { if (BOOT.page !== 'book' && T && T.dirty) { e.preventDefault(); e.returnValue = ''; } });
function teamShootCard(s) {
  if (T.cancelOpen !== s.id) return shootCard(s, '<button class="btn sm red" data-click="teamOpenCancel(\'' + s.id + '\')">ביטול הצילום</button>');
  return shootCard(s) .replace(/<\/div>$/, '') + '<div class="cancelbox"><label style="margin-top:0">סיבת הביטול (לא חובה)</label><textarea id="tx_reason" maxlength="300"></textarea>' +
    '<label class="check"><input id="tx_inf" type="checkbox"> עדכנתי את הלקוח על הביטול</label>' +
    '<div class="row" style="margin-top:12px"><button class="btn sm red" data-click="doTeamCancel(\'' + s.id + '\')">ביטול סופי</button><button class="btn sm ghost" data-click="teamOpenCancel(\'\')">חזרה</button></div></div></div>';
}
function teamOpenCancel(id) { T.cancelOpen = id; var y = window.scrollY; teamRender(); window.scrollTo(0, y); }
function doTeamCancel(id) {
  var inf = document.getElementById('tx_inf');
  if (!inf || !inf.checked) return alertBox('כדי לבטל צריך לסמן שעדכנת את הלקוח');
  var reason = (document.getElementById('tx_reason') || {}).value || '';
  loading();
  call('teamCancel', { id: id, informed: true, reason: reason }).then(function (d) { teamLoaded(d); setTimeout(function () { okBox('הצילום בוטל. בר קיבל עדכון'); }, 50); })
    .catch(function (e) { teamRender(); alertBox(e.message); });
}
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
function teamLogout() { store('apex_team', null); store('apex_team_s', null); AUTH = {}; T = {}; try { google.accounts.id.disableAutoSelect(); } catch (e) {} teamWelcome(); }
function shootCard(s, admin) {
  return '<div class="card shoot"><div class="row" style="justify-content:space-between"><h4>' + esc(s.business) + '</h4><span class="badge">' + esc(s.label) + ' · ' + s.start + ' עד ' + s.end + '</span></div>' +
    '<div class="kv"><div>איש קשר</div><div>' + esc(s.contact) + ' · <a style="color:var(--acc2)" href="tel:' + esc(s.phone) + '">' + esc(s.phone) + '</a></div><div>כתובת</div><div>' + esc(s.address) + '</div>' +
    (s.car ? '<div>רכבים</div><div>' + esc(s.car) + '</div>' : '') + (s.notes ? '<div>הערות</div><div>' + esc(s.notes) + '</div>' : '') + '</div>' +
    filesList(s.files) +
    '<div class="row"><a class="btn sm ghost" href="' + esc(s.waze) + '" target="_blank" rel="noopener">Waze</a><a class="btn sm wa" href="' + esc(s.waClient) + '" target="_blank" rel="noopener">וואטסאפ ללקוח</a>' + (admin || '') + '</div></div>';
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
function adminLogout() { call('adminLogout').catch(function () {}); sstore('apex_adm', null); AUTH = {}; try { google.accounts.id.disableAutoSelect(); } catch (e) {} adminLogin(); }
function adminRender(msg) {
  var d = A.d, nReq = (d.requests || []).length, tabs = [['shoots', 'צילומים' + (nReq ? ' · ' + nReq + (nReq === 1 ? ' בקשה' : ' בקשות') : '')], ['avail', 'לוח ימים'], ['newbook', 'קביעת צילום'], ['team', 'צלמים'], ['conf', 'הגדרות']];
  var html = '<div class="row" style="justify-content:space-between"><h1>ניהול צילומים</h1><button class="btn ghost sm" data-click="adminLogout()">התנתקות</button></div>' +
    '<div class="card"><label style="margin-top:0">קישור לצלמים</label><div class="linkbox"><input readonly value="' + esc(d.links.team) + '"><button class="btn sm" data-click="copy(\'' + d.links.team + '\',this)">העתקה</button><a class="btn sm wa" target="_blank" href="https://wa.me/?text=' + encodeURIComponent('היי, זה הקישור לסימון הזמינות שלך לצילומים של APEX:\n' + d.links.team) + '">שליחה</a></div>' +
    '<label>קישור ללקוחות</label><div class="linkbox"><input readonly value="' + esc(d.links.book) + '"><button class="btn sm" data-click="copy(\'' + d.links.book + '\',this)">העתקה</button><a class="btn sm wa" target="_blank" href="https://wa.me/?text=' + encodeURIComponent('היי, כאן אפשר לבחור יום ושעה לצילום:\n' + d.links.book) + '">שליחה</a></div>' +
    '<p class="muted small" style="margin:10px 0 0">' + (d.freeDays ? 'כרגע יש ' + d.freeDays + ' ימים עם מועדים פנויים ללקוחות' : 'כרגע אין אף מועד פנוי. בקש מהצלמים לסמן זמינות') + '</p></div>';
  if (msg) html += '<div class="okbox">' + esc(msg) + '</div>';
  html += '<div class="tabs">' + tabs.map(function (t) { return '<button class="' + (A.tab === t[0] ? 'on' : '') + '" data-click="setTab(\'' + t[0] + '\')">' + t[1] + '</button>'; }).join('') + '</div>';
  html += ({ shoots: adminShoots, newbook: adminNewBook, avail: adminAvail, team: adminTeam, conf: adminConf })[A.tab]();
  h(html); bar('');
}
function adminRequests() {
  var rq = A.d.requests || []; if (!rq.length) return '';
  var actives = A.d.team.filter(function (t) { return t.active !== 'לא'; });
  return '<h2>בקשות לתאריך אחר</h2>' + rq.map(function (r) {
    var free = actives.filter(function (t) { return r.free.indexOf(t.id) >= 0; });
    var pick = free.length ? '<select id="as_' + esc(r.id) + '" style="width:auto;padding:8px;font-size:14px">' + free.map(function (t) { return '<option value="' + esc(t.id) + '">📸 ' + esc(t.name) + '</option>'; }).join('') + '</select>' +
      '<button class="btn sm" data-click="assignReq(\'' + esc(r.id) + '\')">שיבוץ</button>' : '<span class="muted small">אין צלם פנוי בשעות האלה</span>';
    return '<div class="card shoot req"><div class="row" style="justify-content:space-between"><h4>' + esc(r.business) + '</h4><span class="badge">' + esc(r.label) + ' · ' + r.start + ' עד ' + r.end + '</span></div>' +
      '<p style="margin:8px 0 0"><span class="badge amber">ממתינה לצלם</span></p>' +
      '<div class="kv"><div>איש קשר</div><div>' + esc(r.contact) + ' · <a style="color:var(--acc2)" href="tel:' + esc(r.phone) + '">' + esc(r.phone) + '</a></div><div>מייל</div><div>' + esc(r.email) + '</div><div>כתובת</div><div>' + esc(r.address) + '</div>' +
      (r.car ? '<div>רכבים</div><div>' + esc(r.car) + '</div>' : '') + (r.notes ? '<div>הערות</div><div>' + esc(r.notes) + '</div>' : '') + '</div>' +
      filesList(r.files) + '<div class="row">' + pick + '<a class="btn sm wa" target="_blank" rel="noopener" href="' + esc(r.waClient) + '">וואטסאפ ללקוח</a><button class="btn sm red" data-click="closeReqAdmin(\'' + esc(r.id) + '\')">סגירה</button></div></div>';
  }).join('') + '<h2>צילומים</h2>';
}
function assignReq(id) {
  var el = document.getElementById('as_' + id); if (!el || !el.value) return;
  var n = A.d.team.filter(function (t) { return t.id === el.value; })[0];
  if (!confirm('לשבץ את ' + n.name + '? הוא והלקוח יקבלו אישור')) return;
  adminCall('adminAssignRequest', { id: id, photographerId: el.value }, 'הבקשה שובצה ל' + n.name);
}
function closeReqAdmin(id) { if (!confirm('לסגור את הבקשה? הלקוח יקבל מייל שאין צלם פנוי במועד הזה')) return; adminCall('adminCloseRequest', { id: id, notify: true }, 'הבקשה נסגרה והלקוח עודכן'); }
function adminShoots() {
  var d = A.d, up = d.bookings.filter(function (b) { return b.status === 'פעיל' && b.date >= d.today; });
  var rest = d.bookings.filter(function (b) { return up.indexOf(b) < 0; }).reverse();
  var actives = d.team.filter(function (t) { return t.active !== 'לא'; });
  var html = adminRequests() + (up.length ? '' : '<div class="card muted">אין צילומים קרובים</div>');
  html += up.map(function (b) {
    var sel = '<select style="width:auto;padding:8px;font-size:14px" data-change="reassign(\'' + b.id + '\',this.value)">' + actives.map(function (t) { return '<option value="' + t.id + '"' + (t.id === b.photographerId ? ' selected' : '') + '>📸 ' + esc(t.name) + '</option>'; }).join('') + '</select>';
    return shootCard(b, sel + (b.waPhotographer ? '<a class="btn sm wa" target="_blank" href="' + b.waPhotographer + '">וואטסאפ לצלם</a>' : '') + '<button class="btn sm red" data-click="cancelShoot(\'' + b.id + '\')">ביטול</button>');
  }).join('');
  if (rest.length) html += '<h2>עבר ובוטלו</h2>' + rest.map(function (b) {
    return '<div class="card"><div class="row" style="justify-content:space-between"><span>' + esc(b.label) + ' · ' + esc(b.business) + ' · ' + esc(b.photographer) + '</span><span class="badge ' + (b.status === 'בוטל' ? 'red' : 'gray') + '">' + (b.status === 'בוטל' ? 'בוטל' + (b.cancelledBy ? ' על ידי ' + esc(b.cancelledBy) : '') : 'עבר') + '</span></div>' +
      (b.status === 'בוטל' && b.cancelReason ? '<p class="muted small" style="margin:8px 0 0">סיבה: ' + esc(b.cancelReason) + '</p>' : '') + '</div>';
  }).join('');
  return html;
}
/* admin calendar: per day, who is free and when, and which clients booked or asked for that day */
function adminDays() {
  var d = A.d, names = {}, out = {};
  d.team.forEach(function (t) { names[t.id] = t.name; });
  var day = function (k) { return out[k] = out[k] || { av: [], bk: [], rq: [] }; };
  d.avail.forEach(function (a) { if (names[a.photographerId] && (d.team.filter(function (t) { return t.id === a.photographerId; })[0] || {}).active !== 'לא') day(a.date).av.push({ id: a.photographerId, name: names[a.photographerId], from: a.from, to: a.to }); });
  d.bookings.forEach(function (x) { if (x.status === 'פעיל') day(x.date).bk.push(x); });
  (d.requests || []).forEach(function (r) { day(r.date).rq.push(r); });
  Object.keys(out).forEach(function (k) { out[k].av.sort(function (x, y) { return x.from < y.from ? -1 : 1; }); out[k].bk.sort(function (x, y) { return x.start < y.start ? -1 : 1; }); });
  return out;
}
function adminAvail() {
  var d = A.d, days = adminDays(), team = d.team.filter(function (t) { return t.active !== 'לא'; });
  var first = addDays(d.today, -14).slice(0, 7), last = addDays(d.today, (Number(d.conf.horizonDays) || 60) + 14).slice(0, 7);
  if (!A.month) A.month = d.today.slice(0, 7);
  if (!A.day) A.day = d.today;
  var ym = A.month, md = monthDays(ym), p = ym.split('-').map(Number);
  var html = '<div class="card cal"><div class="calhd"><button class="btn ghost sm" aria-label="החודש הקודם" data-click="aCalNav(\'-1\')"' + (ym > first ? '' : ' disabled') + '>›</button>' +
    '<b>' + MONTHS[p[1] - 1] + ' ' + p[0] + '</b><button class="btn ghost sm" aria-label="החודש הבא" data-click="aCalNav(\'1\')"' + (ym < last ? '' : ' disabled') + '>‹</button></div><div class="calgrid">';
  html += WD.map(function (w) { return '<div class="wd">' + w + '</div>'; }).join('');
  for (var i = 0; i < dow(md[0]); i++) html += '<div class="cd blank"></div>';
  md.forEach(function (k) {
    var x = days[k] || { av: [], bk: [], rq: [] }, past = k < d.today;
    var cls = 'cd' + (past ? ' past' : '') + (x.av.length && !past ? ' av' : '') + (k === A.day ? ' sel' : '') + (k === d.today ? ' today' : '');
    html += '<button class="' + cls + '" data-click="aCalDay(\'' + k + '\')"><b>' + Number(k.slice(8)) + '</b>' +
      (x.av.length && !past ? '<small>' + (x.av.length === 1 ? '1 פנוי' : x.av.length + ' פנויים') + '</small>' : '') +
      ((x.bk.length || x.rq.length) ? '<small class="ic">' + (x.bk.length ? '📸' + x.bk.length : '') + (x.rq.length ? ' ⏳' + x.rq.length : '') + '</small>' : '') + '</button>';
  });
  html += '</div><div class="legend"><span class="l-av">צלמים פנויים</span><span>📸 צילומים שנקבעו</span><span>⏳ בקשות לקוחות</span></div></div>';

  // the selected day
  var x = days[A.day] || { av: [], bk: [], rq: [] }, freeIds = x.av.map(function (a) { return a.id; });
  var notMarked = team.filter(function (t) { return freeIds.indexOf(t.id) < 0; }).map(function (t) { return esc(t.name); });
  html += '<h2 id="aday">יום ' + DAYS[dow(A.day)] + ' ' + dm(A.day) + '</h2>';
  html += '<div class="card"><b>צלמים שסימנו שהם פנויים</b>' + (x.av.length ? '<div class="dlist">' + x.av.map(function (a) {
    var full = a.from === (d.conf.dayStart || '07:00') && a.to === (d.conf.dayEnd || '21:00');
    var busy = x.bk.filter(function (b) { return b.photographerId === a.id; }).map(function (b) { return 'צילום ב ' + esc(b.start); });
    return '<div><span>📸 ' + esc(a.name) + (busy.length ? ' <span class="badge">' + busy.join(', ') + '</span>' : '') + '</span><span class="muted">' + (full ? 'כל היום' : esc(a.from) + ' עד ' + esc(a.to)) + '</span></div>';
  }).join('') + '</div>' : '<p class="muted" style="margin:6px 0 0">אף צלם לא סימן את היום הזה</p>') +
    (notMarked.length && x.av.length ? '<p class="muted small" style="margin:8px 0 0">לא סימנו: ' + notMarked.join(', ') + '</p>' : '') + '</div>';
  html += '<div class="card"><b>לקוחות שקבעו ביום הזה</b>' + (x.bk.length ? '<div class="dlist">' + x.bk.map(function (b) {
    return '<div><span><b>' + esc(b.start) + ' עד ' + esc(b.end) + '</b> · ' + esc(b.business) + ' · ' + esc(b.contact) + ' <a style="color:var(--acc2)" href="tel:' + esc(b.phone) + '">' + esc(b.phone) + '</a></span><span class="muted">📸 ' + esc(b.photographer) + '</span></div>';
  }).join('') + '</div>' : '<p class="muted" style="margin:6px 0 0">אין צילומים ביום הזה</p>') + '</div>';
  if (x.rq.length) html += '<div class="card req"><b>לקוחות שביקשו את היום הזה</b><div class="dlist">' + x.rq.map(function (r) {
    return '<div><span><b>' + esc(r.start) + ' עד ' + esc(r.end) + '</b> · ' + esc(r.business) + ' · ' + esc(r.contact) + ' <a style="color:var(--acc2)" href="tel:' + esc(r.phone) + '">' + esc(r.phone) + '</a></span><span class="badge amber">ממתינה לצלם</span></div>';
  }).join('') + '</div><p class="muted small" style="margin:8px 0 0">שיבוץ או סגירה בלשונית צילומים</p></div>';

  html += '<h2>עריכת זמינות בשם צלם</h2><div class="row">' + team.map(function (t) {
    return '<button class="btn ghost sm" data-click="adminEditAvail(\'' + esc(t.id) + '\')">' + esc(t.name) + '</button>';
  }).join('') + '</div>';
  return html;
}
function aCalNav(k) { A.month = shiftMonth(A.month, Number(k)); var y = window.scrollY; adminRender(); window.scrollTo(0, y); }
function aCalDay(k) { A.day = k; var y = window.scrollY; adminRender(); window.scrollTo(0, y); var el = document.getElementById('aday'); if (el && el.getBoundingClientRect().top > window.innerHeight - 120) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
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
    '<div class="two"><div><label>מייל הלקוח (לאישור ולתזכורת)</label><input id="nb_email" type="email"></div><div><label>רכבים</label><input id="nb_car"></div></div>' +
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
  return '<div class="card"><div class="two"><div><label style="margin-top:0">שם</label><input id="n_' + id + '" value="' + esc(t.name) + '"></div><div><label style="margin-top:0">קוד אישי (4 עד 6 ספרות)</label><input id="c_' + id + '" inputmode="numeric" maxlength="6" value="' + esc(t.pin) + '"></div></div>' +
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
function cancelShoot(id) { var r = prompt('לבטל את הצילום? הצלם והלקוח יקבלו הודעה והמועד ייפתח מחדש.\nסיבת הביטול (לא חובה):', ''); if (r === null) return; adminCall('cancel', { id: id, reason: r }, 'הצילום בוטל'); }
function savePerson(id) {
  var g = function (p) { var el = document.getElementById(p + '_' + id); return el ? el.value : ''; };
  var act = document.getElementById('a_' + id);
  adminCall('savePhotographer', { id: id === 'new' ? '' : id, name: g('n'), pin: g('c'), email: g('e'), phone: g('p'), active: act && !act.checked ? 'לא' : 'כן' }, 'נשמר');
}
function changePw() {
  call('adminPassword', { current: document.getElementById('pw_cur').value, next: document.getElementById('pw_new').value })
    .then(function (r) { if (r && r.token) { sstore('apex_adm', r.token); AUTH = { token: r.token }; } adminRender('הסיסמה הוחלפה. כל שאר החיבורים נותקו'); window.scrollTo(0, 0); }).catch(function (e) { alertBox(e.message); });
}
function saveConf() { var p = {}; ['durationHours', 'bufferMinutes', 'leadDays', 'horizonDays'].forEach(function (k) { p[k] = document.getElementById('k_' + k).value.trim(); }); adminCall('saveConf', p, 'ההגדרות נשמרו'); }

/* ═════════════════════ boot ═════════════════════ */
function forgetClient() { store('apex_client', null); B.form = {}; B.remembered = false; bookRender(); }
function setTab(t) { A.tab = t; adminRender(); }
function reloadPage() { location.reload(); }

/* CSP-safe event delegation: data-click="fn('a', this)" / data-change="fn('a', this.value)" */
var ACTS = { pickDate: pickDate, pickStart: pickStart, submitBooking: submitBooking, teamPin: teamPin, teamNames: teamNames, teamLogout: teamLogout,
  teamSave: teamSave, openReq: openReq, closeReq: closeReq, submitReq: submitReq, backHome: backHome, openTake: openTake, doTake: doTake,
  pickFiles: pickFiles, removeFile: removeFile, mineFiles: mineFiles, calNav: calNav, calTap: calTap, calWeekday: calWeekday, calMonthAll: calMonthAll, calClear: calClear, calHour: calHour, calApply: calApply,
  assignReq: assignReq, closeReqAdmin: closeReqAdmin, aCalNav: aCalNav, aCalDay: aCalDay, copy: copy, setTab: setTab, reassign: reassign,
  cancelShoot: cancelShoot, forgetClient: forgetClient, openCancel: openCancel, doClientCancel: doClientCancel, loadSlots: loadSlots,
  teamOpenCancel: teamOpenCancel, doTeamCancel: doTeamCancel, clientLogout: clientLogout, clientToGoogle: clientToGoogle, clientGuest: clientGuest, teamWelcome: teamWelcome, adminEditAvail: adminEditAvail, adminBack: adminBack, adminDoBook: adminDoBook, savePerson: savePerson, saveConf: saveConf, changePw: changePw, adminLogout: adminLogout, reloadPage: reloadPage, adminDoLogin: adminDoLogin };
function runAct(el, code) {
  var m = /^(\w+)\(([\s\S]*)\)$/.exec(code || ''); if (!m || !Object.prototype.hasOwnProperty.call(ACTS, m[1])) return;
  var args = [], re = /'((?:[^'\\]|\\.)*)'|(this\.value)|(this)/g, x;
  while ((x = re.exec(m[2]))) args.push(x[1] !== undefined ? x[1].replace(/\\(.)/g, '$1') : x[2] ? el.value : el);
  ACTS[m[1]].apply(null, args);
}
document.addEventListener('click', function (e) { var el = e.target.closest && e.target.closest('[data-click]'); if (el) runAct(el, el.getAttribute('data-click')); });
document.addEventListener('change', function (e) { var el = e.target.closest && e.target.closest('[data-change]'); if (el) runAct(el, el.getAttribute('data-change')); });
document.addEventListener('submit', function (e) { var el = e.target.closest && e.target.closest('[data-submit]'); if (el) { e.preventDefault(); runAct(el, el.getAttribute('data-submit')); } });

({ book: bookInit, team: teamInit, admin: adminInit })[BOOT.page]();
