const express = require('express');
const { getDailyCosts, createDailyCost, updateDailyCost, deleteDailyCost } = require('../controllers/dailyCost.controller');
const { protect, verifyShopAccess } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });

router.use('/:shopId', protect, verifyShopAccess);

router.route('/:shopId/daily-costs')
  .get(protect, getDailyCosts)
  .post(protect, createDailyCost);

router.route('/:shopId/daily-costs/:costId')
  .put(protect, updateDailyCost)
  .delete(protect, deleteDailyCost);

module.exports = router;
