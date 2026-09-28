/* מסך הכיתה. שתי לחיצות: תלמיד, ואז סכום.
   כל בדיקת הרשאה נעשית בשרת — כאן רק תצוגה. */

var students = [];
var selected = null;
var lastMovement = null;
var undoTimer = null;

var grid    = document.getElementById('grid');
var empty   = document.getElementById('empty');
var search  = document.getElementById('search');
var pad     = document.getElementById('pad');
var padName = document.getElementById('padName');
var amounts = document.getElementById('amounts');
var free    = document.getElementById('free');
var undoBar = document.getElementById('undo');
var undoText= document.getElementById('undoText');
var undoDial= document.getElementById('undoTimer');
var toastEl = document.getElementById('toast');

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

function render(list) {
  grid.textContent = '';
  empty.hidden = list.length > 0;

  list.forEach(function (s) {
    var card = document.createElement('button');
    card.className = 'card' + (selected && selected.id === s.id ? ' sel' : '');
    card.dataset.id = s.id;

    var name = document.createElement('span');
    name.className = 'sname';
    name.textContent = s.name;
    card.appendChild(name);

    // only shown when another student in this class shares the name
    if (s.namesakes > 1) {
      var tag = document.createElement('span');
      tag.className = 'tag';
      tag.textContent = s.mark ? s.mark : '#' + s.student_no;
      card.appendChild(tag);
    }

    var bal = document.createElement('span');
    bal.className = 'bal num ' + tier(s.balance);
    bal.textContent = s.balance;
    card.appendChild(bal);

    var unit = document.createElement('span');
    unit.className = 'unit';
    unit.textContent = 'נקודות';
    card.appendChild(unit);

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

function select(s) {
  selected = s;
  padName.textContent = s.name + ' · ' + s.balance;
  pad.hidden = false;
  free.value = '';
  render(filtered());
}

function closePad() {
  selected = null;
  pad.hidden = true;
  render(filtered());
}

function amtButton(n, cls) {
  var b = document.createElement('button');
  b.className = 'amt ' + cls;
  b.textContent = n > 0 ? '+' + n : String(n);
  b.addEventListener('click', function () { grant(n); });
  return b;
}

// the common amount is big; the rest are smaller; taking away is set apart.
var MAIN = 1;
var OTHER = [2, 3, 5, 10];
var TAKE = [-1, -2, -5];

function buildAmounts() {
  amounts.textContent = '';

  var mainRow = document.createElement('div');
  mainRow.className = 'row';
  mainRow.appendChild(amtButton(MAIN, 'main'));
  amounts.appendChild(mainRow);

  var rest = document.createElement('div');
  rest.className = 'row';
  OTHER.forEach(function (n) { rest.appendChild(amtButton(n, '')); });
  amounts.appendChild(rest);

  if (window.ROLE === 'teacher') {
    var lbl = document.createElement('div');
    lbl.className = 'minus-label';
    lbl.textContent = 'הורדת נקודות · רק מורה';
    amounts.appendChild(lbl);
    var take = document.createElement('div');
    take.className = 'row';
    TAKE.forEach(function (n) { take.appendChild(amtButton(n, 'minus')); });
    amounts.appendChild(take);
  }
}

function grant(amount) {
  if (!selected) return;
  var id = selected.id;
  api('/api/grant', { studentId: id, amount: amount })
    .then(function (r) {
      var s = students.filter(function (x) { return x.id === id; })[0];
      if (s) s.balance = r.balance;
      lastMovement = r.movementId;
      closePad();
      showUndo((amount > 0 ? '+' : '') + amount + ' ל' + r.name);
    })
    .catch(function (e) { toast(e.message); });
}

function showUndo(text) {
  undoText.textContent = text;
  undoBar.hidden = false;
  var total = 6000, start = Date.now();
  clearInterval(undoTimer);
  undoTimer = setInterval(function () {
    var left = Math.max(0, 1 - (Date.now() - start) / total);
    undoDial.style.setProperty('--p', (left * 100).toFixed(0) + '%');
    if (left === 0) { clearInterval(undoTimer); undoBar.hidden = true; lastMovement = null; }
  }, 100);
}

document.getElementById('undoBtn').addEventListener('click', function () {
  if (!lastMovement) return;
  api('/api/undo', { movementId: lastMovement })
    .then(function () {
      clearInterval(undoTimer);
      undoBar.hidden = true;
      lastMovement = null;
      load();
    })
    .catch(function (e) { toast(e.message); });
});

document.getElementById('padClose').addEventListener('click', closePad);
document.getElementById('freeGo').addEventListener('click', function () {
  var n = parseInt(free.value, 10);
  if (!n) { toast('הקלד סכום'); return; }
  grant(n);
});
free.addEventListener('keydown', function (e) {
  if (e.key === 'Enter') document.getElementById('freeGo').click();
});
search.addEventListener('input', function () { render(filtered()); });
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') closePad();
});

document.getElementById('logout').addEventListener('click', function () {
  api('/api/logout', {}).then(function () { location.href = '/login'; });
});

function load() {
  return api('/api/students?c=' + window.CLASS_ID).then(function (rows) {
    students = rows;
    render(filtered());
  });
}

buildAmounts();
load();
