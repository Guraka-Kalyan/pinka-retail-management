const express = require('express');
const { getPreparations, createPreparation, updatePreparation, deletePreparation } = require('../controllers/preparation.controller');
const { protect } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });

router.route('/:shopId/preparations')
  .get(protect, getPreparations)
  .post(protect, createPreparation);

router.route('/:shopId/preparations/:prepId')
  .put(protect, updatePreparation)
  .delete(protect, deletePreparation);

module.exports = router;
