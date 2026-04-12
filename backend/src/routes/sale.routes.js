const express = require('express');
const { getSales, createSale, updateSale, deleteSale, generateReceipt } = require('../controllers/sale.controller');
const { protect, verifyShopAccess } = require('../middleware/auth');
const { validate, createSaleSchema } = require('../middleware/validate');

const router = express.Router({ mergeParams: true });

router.use('/:shopId', protect, verifyShopAccess);

router.route('/:shopId/sales')
  .get(protect, getSales)
  .post(protect, validate(createSaleSchema), createSale);

router.route('/:shopId/sales/:saleId')
  .put(protect, updateSale)
  .delete(protect, deleteSale);

router.get('/:shopId/sales/:saleId/receipt', protect, generateReceipt);

module.exports = router;
