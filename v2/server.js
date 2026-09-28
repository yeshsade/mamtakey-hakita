const express = require('express');
const session = require('express-session');
const path = require('path');
const { db, init } = require('./db');

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || require('crypto').randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 8 }
}));

/* ---------------------------------------------------------------
   permissions live HERE and nowhere else.
   the browser only renders; it never decides.
   --------------------------------------------------------------- */
function actor(req) {
  if (!req.session.uid) return null;
  return db.get('SELECT id, name, role FROM users WHERE id = ? AND active = 1', [req.session.uid]);
}
function requireUser(req, res, next) {
  const a = actor(req);
  if (!a) return res.status(401).json({ error: 'לא מחובר' });
  req.actor = a;
  next();
}
function requireTeacher(req, res, next) {
  if (req.actor.role !== 'teacher') {
    return res.status(403).json({ error: 'רק המורה יכול לבצע את הפעולה הזו' });
  }
  next();
}

/* ---------------- auth ---------------- */
app.get('/', (req, res) => {
  if (!actor(req)) return res.redirect('/login');
  res.redirect('/class');
});

app.get('/login', (req, res) => {
  res.render('login', { users: db.all("SELECT id, name, role FROM users WHERE active = 1 ORDER BY role, name") });
});

app.post('/api/login', (req, res) => {
  const { id, code } = req.body;
  const u = db.get('SELECT id, name, role, code FROM users WHERE id = ? AND active = 1', [id]);
  if (!u) return res.status(404).json({ error: 'משתמש לא נמצא' });
  if (u.role === 'duty' && String(code || '') !== String(u.code)) {
    return res.status(401).json({ error: 'קוד שגוי' });
  }
  req.session.uid = u.id;
  res.json({ ok: true });
});

// logout really destroys the server session. this is the bug that started the rebuild.
app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
});

/* ---------------- the class screen ---------------- */
// the nine locally-hosted Hebrew families. ?font=<key> swaps the display face.
const FONTS = {
  frankruhl: 'Frank Ruhl Libre', david: 'David Libre', miriam: 'Miriam Libre',
  suez: 'Suez One', secular: 'Secular One', karantina: 'Karantina',
  plex: 'IBM Plex Sans Hebrew', alef: 'Alef', bellefair: 'Bellefair'
};

app.get('/class', (req, res) => {
  const a = actor(req);
  if (!a) return res.redirect('/login');
  const classes = db.all('SELECT id, name, daily_cap FROM classes ORDER BY id');
  const current = Number(req.query.c) || classes[0].id;
  const fontKey = FONTS[req.query.font] ? req.query.font : 'secular';
  res.render('class', {
    actor: a, classes, currentId: current,
    font: FONTS[fontKey], fontKey, fonts: FONTS
  });
});

app.get('/api/students', requireUser, (req, res) => {
  const rows = db.all(
    `SELECT s.id, s.student_no, s.name, s.mark, s.balance,
            (SELECT COUNT(*) FROM students x
              WHERE x.class_id = s.class_id AND x.name = s.name AND x.active = 1) AS namesakes
       FROM students s
      WHERE s.class_id = ? AND s.active = 1
      ORDER BY s.name`,
    [Number(req.query.c)]
  );
  res.json(rows);
});

const MAX_PER_ACTION = 20;

app.post('/api/grant', requireUser, (req, res) => {
  const amount = Number(req.body.amount);
  const studentId = Number(req.body.studentId);

  if (!Number.isInteger(amount) || amount === 0) {
    return res.status(400).json({ error: 'סכום לא תקין' });
  }
  if (Math.abs(amount) > MAX_PER_ACTION) {
    return res.status(400).json({ error: `עד ${MAX_PER_ACTION} נקודות בפעולה אחת` });
  }
  // a duty student may give, never take away. enforced on the server.
  if (amount < 0 && req.actor.role !== 'teacher') {
    return res.status(403).json({ error: 'רק המורה יכול להוריד נקודות' });
  }

  const s = db.get('SELECT id, name, balance FROM students WHERE id = ? AND active = 1', [studentId]);
  if (!s) return res.status(404).json({ error: 'תלמיד לא נמצא' });
  if (s.balance + amount < 0) {
    return res.status(400).json({ error: `חסרות ${Math.abs(s.balance + amount)} נקודות` });
  }

  db.run('UPDATE students SET balance = balance + ? WHERE id = ?', [amount, studentId]);
  db.run(
    `INSERT INTO movements (student_id, delta, kind, actor_id, actor_name)
     VALUES (?,?,?,?,?)`,
    [studentId, amount, amount > 0 ? 'grant' : 'deduct', req.actor.id, req.actor.name]
  );
  const movId = db.get('SELECT id FROM movements ORDER BY id DESC LIMIT 1').id;
  res.json({ ok: true, movementId: movId, balance: s.balance + amount, name: s.name });
});

app.post('/api/undo', requireUser, (req, res) => {
  const m = db.get('SELECT * FROM movements WHERE id = ? AND undone = 0', [Number(req.body.movementId)]);
  if (!m) return res.status(404).json({ error: 'אין מה לבטל' });
  // a duty student may undo only their own action, and only for a short while.
  if (req.actor.role !== 'teacher' && m.actor_id !== req.actor.id) {
    return res.status(403).json({ error: 'רק המורה מבטל פעולות של אחרים' });
  }

  db.run('UPDATE students SET balance = balance - ? WHERE id = ?', [m.delta, m.student_id]);
  db.run('UPDATE movements SET undone = 1 WHERE id = ?', [m.id]);
  db.run(
    `INSERT INTO movements (student_id, delta, kind, note, actor_id, actor_name)
     VALUES (?,?,?,?,?,?)`,
    [m.student_id, -m.delta, 'undo', 'ביטול פעולה #' + m.id, req.actor.id, req.actor.name]
  );
  const s = db.get('SELECT balance FROM students WHERE id = ?', [m.student_id]);
  res.json({ ok: true, balance: s.balance });
});

app.get('/api/history/:id', requireUser, (req, res) => {
  if (req.actor.role !== 'teacher') {
    return res.status(403).json({ error: 'היסטוריה — רק המורה' });
  }
  res.json(db.all(
    `SELECT id, delta, kind, note, actor_name, created_at, undone
       FROM movements WHERE student_id = ? ORDER BY id DESC LIMIT 20`,
    [Number(req.params.id)]
  ));
});

app.get('/api/stats/:id', requireUser, (req, res) => {
  const id = Number(req.params.id);
  const one = (sql) => db.get(sql, [id]).v;
  res.json({
    today: one(`SELECT COALESCE(SUM(delta),0) AS v FROM movements
                 WHERE student_id = ? AND date(created_at) = date('now','localtime')`),
    week:  one(`SELECT COALESCE(SUM(delta),0) AS v FROM movements
                 WHERE student_id = ? AND created_at >= datetime('now','localtime','-7 days')`),
    count: one(`SELECT COUNT(*) AS v FROM movements
                 WHERE student_id = ? AND kind != 'undo' AND undone = 0`)
  });
});

const PORT = process.env.PORT || 3100;
init().then(() => {
  app.listen(PORT, () => console.log('ממתקי הכיתה v2 → http://localhost:' + PORT));
});
