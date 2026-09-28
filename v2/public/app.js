/* מסך הכיתה: מימין כרטיס התלמיד (תמיד פתוח), משמאל כל הכיתה.
   לחיצה על תלמיד פותחת אותו מיד. לחיצה על סכום שומרת מיד.
   כל בדיקת הרשאה נעשית בשרת — כאן רק תצוגה. */

var students = [];
var selected = null;
var lastMovement = null;
var undoTimer = null;

var $ = function (id) { return document.getElementById(id); };
var grid = $('grid'), empty = $('empty'), search = $('search');
var free = $('free'), toastEl = $('toast');

var MAIN = 1;               // הסכום השכיח — גדול ובאקצנט
var OTHER = [2, 3, 5, 10];
var TAKE = [-1, -2, -5];

function tier(b) { return b >= 50 ? 't2' : b >= 10 ? 't1' : 't0'; }

function api(url, body) {
  return fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  }).then(function (r) {
    return r.json().then(function (j) {
      if (!r.ok) throw new Error(j.error || 'שגיאה');
      return j;
    });
  });
}

function toast(msg) {
  toastEl.textContent = msg;
  toastEl.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(function () { toastEl.hidden = true; }, 3000);
}

function el(tag, cls, text) {
  var e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

/* ---------------- הכיתה ---------------- */

// a person silhouette, used until a real photo exists
var SIL = '<svg class="sil" viewBox="0 0 100 110" aria-hidden="true">' +
  '<circle cx="50" cy="38" r="20"/><path d="M12 110 C12 78 30 66 50 66 C70 66 88 78 88 110 Z"/></svg>';

function render(list) {
  grid.textContent = '';
  empty.hidden = list.length > 0;
  list.forEach(function (s) {
    var today = s.today || 0;
    var cls = 'card ' + tier(s.balance) + (today > 0 ? '' : ' idle') +
              (selected && selected.id === s.id ? ' sel' : '');
    var card = el('button', cls);

    // photo layer (ד): real photo when there is one, silhouette until then
    var ph = el('span', 'photo');
    if (s.photo) ph.style.backgroundImage = 'url(' + s.photo + ')';
    else ph.innerHTML = SIL;
    card.appendChild(ph);

    var body = el('span', 'cbody');
    body.appendChild(el('span', 'sname', s.name));
    if (s.namesakes > 1) body.appendChild(el('span', 'tag', s.mark || '#' + s.student_no));
    // today is the big number (ו) — who hasn't been given anything yet stands out
    body.appendChild(el('span', 'today', today > 0 ? '+' + today : today < 0 ? String(today) : '—'));
    var bal = el('span', 'baln');
    bal.appendChild(document.createTextNode('יתרה '));
    bal.appendChild(el('b', 'num', s.balance));
    body.appendChild(bal);
    card.appendChild(body);

    card.addEventListener('click', function () { select(s); });
    grid.appendChild(card);
  });
}

function filtered() {
  var q = search.value.trim();
  if (!q) return students;
  return students.filter(function (s) {
    return s.name.indexOf(q) !== -1 || s.student_no.indexOf(q) !== -1;
  });
}

/* ---------------- כרטיס התלמיד ---------------- */

function select(s) {
  selected = s;
  render(filtered());
  paintPanel();
  loadStats();
  loadHistory();
}

function paintPanel() {
  var s = selected;
  if (!s) return;
  $('pClass').textContent = window.CLASS_NAME || '';
  $('pNo').textContent = '#' + s.student_no;
  $('pName').textContent = s.name + (s.namesakes > 1 && s.mark ? ' · ' + s.mark : '');
  $('pBal').textContent = s.balance;
}

function loadStats() {
  if (!selected) return;
  api('/api/stats/' + selected.id).then(function (r) {
    $('sToday').textContent = (r.today > 0 ? '+' : '') + r.today;
    $('sWeek').textContent = (r.week > 0 ? '+' : '') + r.week;
    $('sCount').textContent = r.count;
  }).catch(function () {});
}

function when(ts) {
  // "2026-09-28 09:42:11" → "09:42", or the date if not today
  var today = new Date().toISOString().slice(0, 10);
  return ts.slice(0, 10) === today ? ts.slice(11, 16) : ts.slice(8, 10) + '/' + ts.slice(5, 7);
}

function loadHistory() {
  var hist = $('hist');
  hist.textContent = '';
  if (!selected) return;
  if (window.ROLE !== 'teacher') {
    hist.appendChild(el('li', 'none', 'היסטוריה — רק המורה'));
    return;
  }
  api('/api/history/' + selected.id).then(function (rows) {
    hist.textContent = '';
    if (!rows.length) { hist.appendChild(el('li', 'none', 'אין עדיין תנועות')); return; }
    rows.slice(0, 8).forEach(function (m) {
      var li = el('li');
      var cls = m.undone ? 'off' : m.delta > 0 ? 'plus' : 'minus';
      li.appendChild(el('span', 'h-d ' + cls, (m.delta > 0 ? '+' : '') + m.delta));
      li.appendChild(el('span', 'h-who', m.kind === 'undo' ? 'ביטול · ' + m.actor_name : m.actor_name));
      li.appendChild(el('span', 'h-when num', when(m.created_at)));
      hist.appendChild(li);
    });
  }).catch(function (e) { hist.appendChild(el('li', 'none', e.message)); });
}

function buildButtons() {
  var circles = $('circles');
  circles.textContent = '';
  [MAIN].concat(OTHER).forEach(function (n) {
    var b = el('button', 'circle' + (n === MAIN ? ' main' : ''), '+' + n);
    b.addEventListener('click', function () { grant(n); });
    circles.appendChild(b);
  });

  if (window.ROLE === 'teacher') {
    $('takeBlock').hidden = false;
    var pills = $('pills');
    pills.textContent = '';
    TAKE.forEach(function (n) {
      var b = el('button', 'pill', String(n).replace('-', '−'));
      b.addEventListener('click', function () { grant(n); });
      pills.appendChild(b);
    });
  }
}

/* ---------------- פעולות ---------------- */

function grant(amount) {
  if (!selected) { toast('בחר תלמיד'); return; }
  var id = selected.id;
  api('/api/grant', { studentId: id, amount: amount })
    .then(function (r) {
      var s = students.filter(function (x) { return x.id === id; })[0];
      if (s) { s.balance = r.balance; s.today = (s.today || 0) + amount; }
      lastMovement = r.movementId;
      free.value = '';
      render(filtered());
      paintPanel();
      loadStats();
      loadHistory();
      showUndo((amount > 0 ? '+' : '') + amount + ' ל' + r.name);
    })
    .catch(function (e) { toast(e.message); });
}

function showUndo(text) {
  $('undoText').textContent = text;
  $('undo').hidden = false;
  var total = 6000, start = Date.now();
  clearInterval(undoTimer);
  undoTimer = setInterval(function () {
    var left = Math.max(0, 1 - (Date.now() - start) / total);
    $('undoTimer').style.setProperty('--p', (left * 100).toFixed(0) + '%');
    if (left === 0) { clearInterval(undoTimer); $('undo').hidden = true; lastMovement = null; }
  }, 100);
}

$('undoBtn').addEventListener('click', function () {
  if (!lastMovement) return;
  api('/api/undo', { movementId: lastMovement })
    .then(function () {
      clearInterval(undoTimer);
      $('undo').hidden = true;
      lastMovement = null;
      load();
    })
    .catch(function (e) { toast(e.message); });
});

$('freeGo').addEventListener('click', function () {
  var n = parseInt(free.value, 10);
  if (!n) { toast('הקלד סכום'); return; }
  grant(n);
});
free.addEventListener('keydown', function (e) { if (e.key === 'Enter') $('freeGo').click(); });

// חיפוש או סריקת ברקוד: Enter פותח את התלמיד הראשון שנמצא
search.addEventListener('input', function () { render(filtered()); });
search.addEventListener('keydown', function (e) {
  if (e.key !== 'Enter') return;
  var hit = filtered()[0];
  if (hit) { select(hit); search.value = ''; render(filtered()); }
});

$('logout').addEventListener('click', function () {
  api('/api/logout', {}).then(function () { location.href = '/login'; });
});

function load() {
  return api('/api/students?c=' + window.CLASS_ID).then(function (rows) {
    students = rows;
    var keep = selected && rows.filter(function (x) { return x.id === selected.id; })[0];
    select(keep || rows[0] || null);
  });
}

buildButtons();
load();
