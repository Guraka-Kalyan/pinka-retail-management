const express = require('express');
const { getDashboardSummary } = require('../controllers/dashboard.controller');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.get('/summary', protect, getDashboardSummary);

module.exports = router;
