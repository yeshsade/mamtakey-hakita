const express = require('express');
const session = require('express-session');
const path = require('path');
const { getDb, applyScheduledPrices } = require('./database');

const app = express();
const PORT = process.env.PORT || 3001;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));

app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'mamtakey-hakita-secret-key',
  resave: false,
  saveUninitialized: false
}));

app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

getDb();
applyScheduledPrices();
setInterval(applyScheduledPrices, 60 * 60 * 1000);

const bankRoutes = require('./routes/bank');
const storeRoutes = require('./routes/store');
const adminRoutes = require('./routes/admin');
const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');

app.get('/', (req, res) => res.render('home'));

app.use('/bank', bankRoutes);
app.use('/store', storeRoutes);
app.use('/admin', adminRoutes);
app.use('/auth', authRoutes);
app.use('/api', apiRoutes);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`ממתקי הכיתה רץ על http://localhost:${PORT}`);
});
