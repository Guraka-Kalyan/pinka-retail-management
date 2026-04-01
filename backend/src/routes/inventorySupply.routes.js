const express = require('express');
const { getSupplies, createSupply, updateSupply, deleteSupply } = require('../controllers/inventorySupply.controller');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.route('/')
  .get(protect, getSupplies)
  .post(protect, createSupply);

router.route('/:id')
  .put(protect, updateSupply)
  .delete(protect, deleteSupply);

module.exports = router;
