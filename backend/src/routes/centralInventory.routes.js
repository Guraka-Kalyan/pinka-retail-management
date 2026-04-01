const express = require('express');
const { getCentralInventory, createCentralInventory, getCentralInventoryItem, updateCentralInventory, deleteCentralInventory } = require('../controllers/centralInventory.controller');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.route('/')
  .get(protect, getCentralInventory)
  .post(protect, createCentralInventory);

router.route('/:id')
  .get(protect, getCentralInventoryItem)
  .put(protect, updateCentralInventory)
  .delete(protect, deleteCentralInventory);

module.exports = router;
