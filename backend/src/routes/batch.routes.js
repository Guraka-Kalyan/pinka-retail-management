const express = require('express');
const { getBatches, getBatch, createBatch, updateBatch, packageBatch, deleteBatch } = require('../controllers/batch.controller');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.route('/')
  .get(protect, getBatches)
  .post(protect, createBatch);

router.route('/:id')
  .get(protect, getBatch)
  .put(protect, updateBatch)
  .delete(protect, deleteBatch);

router.put('/:id/packaging', protect, packageBatch);

module.exports = router;
