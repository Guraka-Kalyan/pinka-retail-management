const express = require('express');
const { getShops, getShop, createShop, updateShop, deleteShop, getShopStock } = require('../controllers/shop.controller');
const { protect } = require('../middleware/auth');
const { validate, createShopSchema } = require('../middleware/validate');

const router = express.Router();

router.route('/')
  .get(protect, getShops)
  .post(protect, validate(createShopSchema), createShop);

router.route('/:id')
  .get(protect, getShop)
  .put(protect, updateShop)
  .delete(protect, deleteShop);

router.get('/:id/stock', protect, getShopStock);

module.exports = router;
