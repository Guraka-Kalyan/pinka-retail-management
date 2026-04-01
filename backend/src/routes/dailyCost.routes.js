const express = require('express');
const { getDailyCosts, createDailyCost, updateDailyCost, deleteDailyCost } = require('../controllers/dailyCost.controller');
const { protect } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });

router.route('/:shopId/daily-costs')
  .get(protect, getDailyCosts)
  .post(protect, createDailyCost);

router.route('/:shopId/daily-costs/:costId')
  .put(protect, updateDailyCost)
  .delete(protect, deleteDailyCost);

module.exports = router;
