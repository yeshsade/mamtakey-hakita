const express = require('express');
const router = express.Router();
const { getDb } = require('../database');

router.get('/student/:barcode', (req, res) => {
  const db = getDb();
  const student = db.prepare('SELECT * FROM students WHERE barcode = ? AND active = 1').get(req.params.barcode);
  if (!student) return res.json({ found: false });
  res.json({ found: true, student });
});

router.get('/product/:barcode', (req, res) => {
  const db = getDb();
  const product = db.prepare('SELECT * FROM products WHERE barcode = ? AND active = 1').get(req.params.barcode);
  if (!product) return res.json({ found: false });
  res.json({ found: true, product });
});

router.post('/bank/deposit', (req, res) => {
  const { student_id, amount, description } = req.body;
  const db = getDb();
  const amt = parseInt(amount);
  if (!amt || amt <= 0) return res.json({ success: false, error: 'סכום לא תקין' });

  db.prepare('UPDATE students SET balance = balance + ? WHERE id = ?').run(amt, student_id);
  db.prepare('INSERT INTO transactions (student_id, type, amount, description) VALUES (?, ?, ?, ?)')
    .run(student_id, 'deposit', amt, description || 'הפקדה');

  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(student_id);
  res.json({ success: true, balance: student.balance });
});

router.post('/bank/withdraw', (req, res) => {
  const { student_id, amount, description } = req.body;
  const db = getDb();
  const amt = parseInt(amount);
  if (!amt || amt <= 0) return res.json({ success: false, error: 'סכום לא תקין' });

  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(student_id);
  if (student.balance < amt) return res.json({ success: false, error: 'אין מספיק יתרה' });

  db.prepare('UPDATE students SET balance = balance - ? WHERE id = ?').run(amt, student_id);
  db.prepare('INSERT INTO transactions (student_id, type, amount, description) VALUES (?, ?, ?, ?)')
    .run(student_id, 'withdraw', amt, description || 'משיכה');

  const updated = db.prepare('SELECT * FROM students WHERE id = ?').get(student_id);
  res.json({ success: true, balance: updated.balance });
});

router.post('/store/purchase', (req, res) => {
  const { student_id, product_id, quantity } = req.body;
  const db = getDb();
  const qty = parseInt(quantity) || 1;

  const product = db.prepare('SELECT * FROM products WHERE id = ? AND active = 1').get(product_id);
  if (!product) return res.json({ success: false, error: 'מוצר לא נמצא' });

  const totalPrice = product.price * qty;
  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(student_id);
  if (student.balance < totalPrice) return res.json({ success: false, error: 'אין מספיק יתרה' });

  db.prepare('UPDATE students SET balance = balance - ? WHERE id = ?').run(totalPrice, student_id);
  db.prepare('INSERT INTO purchases (student_id, product_id, quantity, total_price) VALUES (?, ?, ?, ?)')
    .run(student_id, product_id, qty, totalPrice);
  db.prepare('INSERT INTO transactions (student_id, type, amount, description) VALUES (?, ?, ?, ?)')
    .run(student_id, 'purchase', totalPrice, `קנייה: ${product.name} x${qty}`);

  const updated = db.prepare('SELECT * FROM students WHERE id = ?').get(student_id);
  res.json({ success: true, balance: updated.balance, totalPrice });
});

router.get('/products', (req, res) => {
  const db = getDb();
  const products = db.prepare('SELECT * FROM products WHERE active = 1 ORDER BY name').all();
  res.json(products);
});

router.get('/student/:id/history', (req, res) => {
  const db = getDb();
  const transactions = db.prepare(
    'SELECT * FROM transactions WHERE student_id = ? ORDER BY created_at DESC LIMIT 20'
  ).all(req.params.id);
  res.json(transactions);
});

module.exports = router;
