const express = require('express');
const { getSettings, updateSettings } = require('../controllers/settings.controller');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.route('/selling-costs')
  .get(protect, getSettings)
  .put(protect, updateSettings);

module.exports = router;
