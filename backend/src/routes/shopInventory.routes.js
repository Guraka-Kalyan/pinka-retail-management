const express = require('express');
const { getShopInventory, createShopInventory, updateShopInventory, deleteShopInventory } = require('../controllers/shopInventory.controller');
const { protect } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });

router.route('/:shopId/inventory-in')
  .get(protect, getShopInventory)
  .post(protect, createShopInventory);

router.route('/:shopId/inventory-in/:id')
  .put(protect, updateShopInventory)
  .delete(protect, deleteShopInventory);

module.exports = router;
