const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { getDb, needsSetup } = require('../database');

router.get('/setup', (req, res) => {
  if (!needsSetup()) return res.redirect('/');
  res.render('setup', { error: null });
});

router.post('/setup', (req, res) => {
  if (!needsSetup()) return res.redirect('/');
  const { username, password, password2 } = req.body;

  if (!username || !password) {
    return res.render('setup', { error: 'מלא את כל השדות' });
  }
  if (password.length < 4) {
    return res.render('setup', { error: 'הסיסמה חייבת להיות לפחות 4 תווים' });
  }
  if (password !== password2) {
    return res.render('setup', { error: 'הסיסמאות לא תואמות' });
  }

  const db = getDb();
  const hash = bcrypt.hashSync(password, 10);
  db.prepare('INSERT INTO users (username, password, role, permissions) VALUES (?, ?, ?, ?)')
    .run(username, hash, 'admin', 'store,bank,admin');

  req.session.user = { id: 1, username, role: 'admin', permissions: 'store,bank,admin' };
  res.redirect('/admin');
});

router.get('/login', (req, res) => {
  if (needsSetup()) return res.redirect('/auth/setup');
  res.render('login', { error: null });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE username = ? AND active = 1').get(username);

  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.render('login', { error: 'שם משתמש או סיסמה שגויים' });
  }

  req.session.user = {
    id: user.id,
    username: user.username,
    role: user.role,
    permissions: user.permissions || ''
  };
  res.redirect(user.role === 'admin' ? '/admin' : '/');
});

router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

module.exports = router;
