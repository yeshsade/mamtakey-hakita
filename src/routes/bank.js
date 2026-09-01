const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.render('bank', { sessionUser: req.session.user || null });
});

module.exports = router;
