const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DIR, 'v2.db');

let raw = null;

function save() {
  fs.writeFileSync(DB_PATH, Buffer.from(raw.export()));
}

const db = {
  run(sql, params = []) {
    raw.run(sql, params);
    // read the counter before save(): export() resets it to 0
    const changes = raw.getRowsModified();
    save();
    return { changes };
  },
  get(sql, params = []) {
    const s = raw.prepare(sql);
    if (params.length) s.bind(params);
    const row = s.step() ? s.getAsObject() : undefined;
    s.free();
    return row;
  },
  all(sql, params = []) {
    const out = [];
    const s = raw.prepare(sql);
    if (params.length) s.bind(params);
    while (s.step()) out.push(s.getAsObject());
    s.free();
    return out;
  },
  exec(sql) { raw.exec(sql); save(); }
};

const SCHEMA = `
CREATE TABLE IF NOT EXISTS classes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  daily_cap  INTEGER NOT NULL DEFAULT 20
);

-- student_no is the permanent identity. names may change; this never does.
CREATE TABLE IF NOT EXISTS students (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id   INTEGER NOT NULL REFERENCES classes(id),
  student_no TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  mark       TEXT,                      -- כינוי להבחנה בין שמות זהים
  balance    INTEGER NOT NULL DEFAULT 0,
  active     INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS users (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  name      TEXT NOT NULL,
  role      TEXT NOT NULL CHECK (role IN ('teacher','duty')),
  code      TEXT UNIQUE,                -- קוד קצר לתורן
  active    INTEGER NOT NULL DEFAULT 1
);

-- every movement records WHO did it. nothing is deleted; undo writes a row.
CREATE TABLE IF NOT EXISTS movements (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id),
  delta      INTEGER NOT NULL,
  kind       TEXT NOT NULL,             -- grant | deduct | undo
  note       TEXT,
  actor_id   INTEGER NOT NULL REFERENCES users(id),
  actor_name TEXT NOT NULL,
  undone     INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE INDEX IF NOT EXISTS idx_mov_student ON movements(student_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_stu_class   ON students(class_id, name);
`;

const DEMO = [
  ['דני כהן', 42], ['שרה לוי', 18], ['יוסי מזרחי', 7], ['מיכל אברהם', 63],
  ['דוד כהן', 25], ['נועה פרץ', 31], ['אורי ביטון', 12], ['תמר דהן', 54],
  ['איתי שלום', 0], ['ליאור אזולאי', 38], ['מאיה גבאי', 22], ['עומר חדד', 47],
  ['שירה נחום', 15], ['אריאל בן דוד', 29], ['הדר קמחי', 71], ['יונתן סבג', 9],
  ['רוני אוחיון', 33], ['גיל אשכנזי', 26], ['טל רוזן', 44], ['אלון מלכה', 5],
  ['נטע צור', 58], ['עידו הרוש', 20], ['שני ברק', 36], ['רועי עמר', 13],
  ['דוד כהן', 49], ['אביב שרעבי', 3], ['יעל טולדנו', 27], ['נדב אלימלך', 61],
  ['ספיר ועקנין', 16], ['איתמר לוגסי', 40], ['מור אסולין', 24], ['עמית זכריה', 8],
  ['גיא נחמיאס', 52], ['ליבי שטרית', 30], ['אורן חזן', 11], ['דנה קדוש', 45]
];

async function init() {
  if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });
  const SQL = await initSqlJs();
  raw = fs.existsSync(DB_PATH)
    ? new SQL.Database(fs.readFileSync(DB_PATH))
    : new SQL.Database();

  db.exec(SCHEMA);

  if (!db.get('SELECT id FROM classes LIMIT 1')) {
    db.run('INSERT INTO classes (name, daily_cap) VALUES (?, ?)', ['כיתה א׳', 20]);
    db.run('INSERT INTO classes (name, daily_cap) VALUES (?, ?)', ['כיתה ב׳', 20]);
    db.run("INSERT INTO users (name, role, code) VALUES ('המורה יוסף','teacher',NULL)");
    db.run("INSERT INTO users (name, role, code) VALUES ('שרה לוי','duty','4821')");

    const cls = db.get('SELECT id FROM classes ORDER BY id LIMIT 1').id;
    DEMO.forEach(([name, bal], i) => {
      // two דוד כהן in the same class — one carries a mark
      const mark = (name === 'דוד כהן' && i === 4) ? 'משקפיים' : null;
      db.run(
        'INSERT INTO students (class_id, student_no, name, mark, balance) VALUES (?,?,?,?,?)',
        [cls, String(1001 + i), name, mark, bal]
      );
    });
  }
  return db;
}

module.exports = { db, init };
