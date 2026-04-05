const express = require('express');
const { getSalesSummary, getCostsSummary, getInventorySummary, getCounterCashSummary } = require('../controllers/report.controller');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.get('/sales-summary', protect, getSalesSummary);
router.get('/costs-summary', protect, getCostsSummary);
router.get('/inventory-summary', protect, getInventorySummary);
router.get('/counter-cash-summary', protect, getCounterCashSummary);

const { getAnalytics } = require('../controllers/analytics.controller');
router.get('/analytics', protect, getAnalytics);

module.exports = router;
