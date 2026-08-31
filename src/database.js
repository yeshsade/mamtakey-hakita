const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, '..', 'data', 'mamtakey.db');

let dbWrapper = null;
let inTransaction = false;

function saveDb() {
  if (!dbWrapper || inTransaction) return;
  const data = dbWrapper._db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function createWrapper(sqlDb) {
  return {
    _db: sqlDb,

    exec(sql) {
      sqlDb.exec(sql);
      saveDb();
    },

    pragma(str) {
      sqlDb.exec('PRAGMA ' + str);
    },

    prepare(sql) {
      return {
        run(...params) {
          sqlDb.run(sql, params);
          saveDb();
          return { changes: sqlDb.getRowsModified() };
        },
        get(...params) {
          const stmt = sqlDb.prepare(sql);
          if (params.length > 0) stmt.bind(params);
          let row;
          if (stmt.step()) {
            row = stmt.getAsObject();
          }
          stmt.free();
          return row;
        },
        all(...params) {
          const results = [];
          const stmt = sqlDb.prepare(sql);
          if (params.length > 0) stmt.bind(params);
          while (stmt.step()) {
            results.push(stmt.getAsObject());
          }
          stmt.free();
          return results;
        }
      };
    },

    transaction(fn) {
      return (...args) => {
        sqlDb.run('BEGIN TRANSACTION');
        inTransaction = true;
        try {
          fn(...args);
          sqlDb.run('COMMIT');
          inTransaction = false;
          saveDb();
        } catch (e) {
          inTransaction = false;
          sqlDb.run('ROLLBACK');
          throw e;
        }
      };
    }
  };
}

function initTables() {
  dbWrapper.exec(`
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      barcode TEXT UNIQUE NOT NULL,
      balance INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      barcode TEXT UNIQUE,
      price INTEGER NOT NULL,
      image_url TEXT,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS price_schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      new_price INTEGER NOT NULL,
      effective_date TEXT NOT NULL,
      applied INTEGER DEFAULT 0,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      amount INTEGER NOT NULL,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (student_id) REFERENCES students(id)
    );

    CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER DEFAULT 1,
      total_price INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (student_id) REFERENCES students(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'helper'
    );
  `);

  const adminExists = dbWrapper.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  if (!adminExists) {
    const hash = bcrypt.hashSync('1234', 10);
    dbWrapper.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run('admin', hash, 'admin');
  }
}

async function initDatabase() {
  if (dbWrapper) return dbWrapper;

  const SQL = await initSqlJs();
  const dataDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  let sqlDb;
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    sqlDb = new SQL.Database(buffer);
  } else {
    sqlDb = new SQL.Database();
  }

  dbWrapper = createWrapper(sqlDb);
  dbWrapper.pragma('journal_mode = WAL');
  dbWrapper.pragma('foreign_keys = ON');
  initTables();
  return dbWrapper;
}

function getDb() {
  if (!dbWrapper) throw new Error('Database not initialized');
  return dbWrapper;
}

function applyScheduledPrices() {
  const db = getDb();
  const now = new Date().toISOString().slice(0, 10);
  const schedules = db.prepare(
    'SELECT * FROM price_schedules WHERE effective_date <= ? AND applied = 0'
  ).all(now);

  for (const s of schedules) {
    db.prepare('UPDATE products SET price = ? WHERE id = ?').run(s.new_price, s.product_id);
    db.prepare('UPDATE price_schedules SET applied = 1 WHERE id = ?').run(s.id);
  }
  return schedules.length;
}

module.exports = { initDatabase, getDb, applyScheduledPrices };
