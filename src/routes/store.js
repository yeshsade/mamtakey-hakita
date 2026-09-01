const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.render('store', { sessionUser: req.session.user || null });
});

module.exports = router;
