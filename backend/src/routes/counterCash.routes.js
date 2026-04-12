const express = require('express');
const { getCounterCash, setCounterCash, getCounterCashHistory } = require('../controllers/counterCash.controller');
const { protect } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });

router.get('/:shopId/counter-cash/history', protect, getCounterCashHistory);

router.route('/:shopId/counter-cash')
  .get(protect, getCounterCash)
  .post(protect, setCounterCash);

module.exports = router;
