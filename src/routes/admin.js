const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { getDb, generateOperatorBarcode } = require('../database');

function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.redirect('/auth/login');
  }
  next();
}

router.use(requireAdmin);

router.get('/', (req, res) => {
  const db = getDb();
  const students = db.prepare('SELECT * FROM students WHERE active = 1 ORDER BY name').all();
  const products = db.prepare('SELECT * FROM products WHERE active = 1 ORDER BY name').all();
  const schedules = db.prepare(`
    SELECT ps.*, p.name as product_name
    FROM price_schedules ps
    JOIN products p ON ps.product_id = p.id
    WHERE ps.applied = 0
    ORDER BY ps.effective_date
  `).all();
  const operators = db.prepare('SELECT id, username, role, barcode, permissions, active FROM users WHERE role = ? AND active = 1').all('operator');
  res.render('admin', { students, products, schedules, operators });
});

router.post('/student/add', (req, res) => {
  const { name } = req.body;
  const db = getDb();
  const barcode = 'STU' + Date.now().toString().slice(-8) + Math.random().toString(36).slice(-3).toUpperCase();
  db.prepare('INSERT INTO students (name, barcode) VALUES (?, ?)').run(name, barcode);
  res.redirect('/admin');
});

router.post('/student/remove/:id', (req, res) => {
  const db = getDb();
  db.prepare('UPDATE students SET active = 0 WHERE id = ?').run(req.params.id);
  res.redirect('/admin');
});

router.post('/product/add', (req, res) => {
  const { name, barcode, price } = req.body;
  const db = getDb();
  const existing = db.prepare('SELECT id FROM products WHERE barcode = ?').get(barcode);
  if (existing) {
    db.prepare('UPDATE products SET name = ?, price = ?, active = 1 WHERE id = ?')
      .run(name, parseInt(price), existing.id);
  } else {
    db.prepare('INSERT INTO products (name, barcode, price) VALUES (?, ?, ?)')
      .run(name, barcode || null, parseInt(price));
  }
  res.redirect('/admin');
});

router.post('/product/remove/:id', (req, res) => {
  const db = getDb();
  db.prepare('UPDATE products SET active = 0 WHERE id = ?').run(req.params.id);
  res.redirect('/admin');
});

router.post('/price-schedule/add', (req, res) => {
  const { product_id, new_price, effective_date } = req.body;
  const db = getDb();
  db.prepare('INSERT INTO price_schedules (product_id, new_price, effective_date) VALUES (?, ?, ?)')
    .run(parseInt(product_id), parseInt(new_price), effective_date);
  res.redirect('/admin');
});

router.post('/price-schedule/remove/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM price_schedules WHERE id = ?').run(req.params.id);
  res.redirect('/admin');
});

router.post('/operator/add', (req, res) => {
  const { username, password } = req.body;
  const permissions = [];
  if (req.body.perm_store) permissions.push('store');
  if (req.body.perm_bank) permissions.push('bank');
  if (req.body.perm_admin) permissions.push('admin');

  const db = getDb();
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return res.redirect('/admin?error=username_taken');
  }

  const hash = bcrypt.hashSync(password || '0000', 10);
  const barcode = generateOperatorBarcode();
  db.prepare('INSERT INTO users (username, password, role, barcode, permissions) VALUES (?, ?, ?, ?, ?)')
    .run(username, hash, 'operator', barcode, permissions.join(','));
  res.redirect('/admin?tab=operators');
});

router.post('/operator/remove/:id', (req, res) => {
  const db = getDb();
  db.prepare('UPDATE users SET active = 0 WHERE id = ? AND role = ?').run(req.params.id, 'operator');
  res.redirect('/admin?tab=operators');
});

router.post('/operator/regenerate/:id', (req, res) => {
  const db = getDb();
  const barcode = generateOperatorBarcode();
  db.prepare('UPDATE users SET barcode = ? WHERE id = ? AND role = ?').run(barcode, req.params.id, 'operator');
  res.redirect('/admin?tab=operators');
});

router.get('/print-cards', (req, res) => {
  const db = getDb();
  const students = db.prepare('SELECT * FROM students WHERE active = 1 ORDER BY name').all();
  res.render('print-cards', { students });
});

router.get('/distribution-sheet', (req, res) => {
  const db = getDb();
  const students = db.prepare('SELECT * FROM students WHERE active = 1 ORDER BY name').all();
  res.render('distribution-sheet', { students });
});

router.post('/distribution-sheet/apply', (req, res) => {
  const { distributions } = req.body;
  const db = getDb();
  const insert = db.prepare('INSERT INTO transactions (student_id, type, amount, description) VALUES (?, ?, ?, ?)');
  const update = db.prepare('UPDATE students SET balance = balance + ? WHERE id = ?');

  const applyAll = db.transaction((items) => {
    for (const item of items) {
      if (item.amount > 0) {
        update.run(item.amount, item.student_id);
        insert.run(item.student_id, 'deposit', item.amount, 'חלוקה יומית');
      }
    }
  });

  applyAll(distributions);
  res.json({ success: true });
});

module.exports = router;
