const express = require('express');
const { getShopInventory, createShopInventory, updateShopInventory, deleteShopInventory } = require('../controllers/shopInventory.controller');
const { protect, verifyShopAccess } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });

router.use('/:shopId', protect, verifyShopAccess);

router.route('/:shopId/inventory-in')
  .get(protect, getShopInventory)
  .post(protect, createShopInventory);

router.route('/:shopId/inventory-in/:id')
  .put(protect, updateShopInventory)
  .delete(protect, deleteShopInventory);

module.exports = router;
