const mongoose = require('mongoose');
const Shop = require('../models/Shop.model');
const ShopInventory = require('../models/ShopInventory.model');
const Preparation = require('../models/Preparation.model');
const Sale = require('../models/Sale.model');
// @desc   Get all shops
// @route  GET /api/shops
const getShops = async (req, res) => {
  const shops = await Shop.find().sort({ createdAt: -1 });
  res.json({ success: true, data: shops });
};

// @desc   Get single shop
// @route  GET /api/shops/:id
const getShop = async (req, res) => {
  const shop = await Shop.findById(req.params.id);
  if (!shop) return res.status(404).json({ success: false, message: 'Shop not found' });
  res.json({ success: true, data: shop });
};

// Helper for dynamic stock
// OPTIMIZED: Uses MongoDB $group aggregation — O(1) regardless of data size.
// Previously loaded all historical records into Node.js and reduced in JS (O(n) growth).
const getLiveStock = async (shopId) => {
  const id = new mongoose.Types.ObjectId(shopId);

  const [invAgg, prepAgg, saleAgg] = await Promise.all([
    ShopInventory.aggregate([
      { $match: { shopId: id } },
      { $group: {
          _id: null,
          bone:     { $sum: '$bone' },
          boneless: { $sum: '$boneless' },
          mixed:    { $sum: '$mixed' },
      }},
    ]),
    Preparation.aggregate([
      { $match: { shopId: id } },
      { $group: {
          _id: null,
          boneUsed:     { $sum: '$boneUsed' },
          bonelessUsed: { $sum: '$bonelessUsed' },
          fryOutput:    { $sum: '$fryOutput' },
          curryOutput:  { $sum: '$curryOutput' },
      }},
    ]),
    Sale.aggregate([
      { $match: { shopId: id, deletedAt: null } },
      { $group: {
          _id: null,
          boneSold:     { $sum: '$boneSold' },
          bonelessSold: { $sum: '$bonelessSold' },
          mixedSold:    { $sum: '$mixedSold' },
          frySold:      { $sum: '$frySold' },
          currySold:    { $sum: '$currySold' },
      }},
    ]),
  ]);

  const inv  = invAgg[0]  || {};
  const prep = prepAgg[0] || {};
  const sale = saleAgg[0] || {};

  return {
    boneStock:     (inv.bone     || 0) - (sale.boneSold     || 0) - (prep.boneUsed     || 0),
    bonelessStock: (inv.boneless || 0) - (sale.bonelessSold || 0) - (prep.bonelessUsed || 0),
    mixedStock:    (inv.mixed    || 0) - (sale.mixedSold    || 0),
    fryStock:      (prep.fryOutput   || 0) - (sale.frySold   || 0),
    curryStock:    (prep.curryOutput || 0) - (sale.currySold || 0),
  };
};

// @desc   Get live shop stock
// @route  GET /api/shops/:id/stock
const getShopStock = async (req, res) => {
  try {
    const stock = await getLiveStock(req.params.id);
    res.json({ success: true, data: stock });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to calculate stock' });
  }
};

// @desc   Create shop
// @route  POST /api/shops
const createShop = async (req, res) => {
  const { name, displayId, managerName, phone, location } = req.body;
  if (!name) return res.status(400).json({ success: false, message: 'Shop name is required' });

  const shop = await Shop.create({ name, displayId, managerName, phone, location });
  res.status(201).json({ success: true, data: shop });
};

// @desc   Update shop
// @route  PUT /api/shops/:id
const updateShop = async (req, res) => {
  const shop = await Shop.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!shop) return res.status(404).json({ success: false, message: 'Shop not found' });
  res.json({ success: true, data: shop });
};

// @desc   Delete shop
// @route  DELETE /api/shops/:id
const deleteShop = async (req, res) => {
  const shop = await Shop.findByIdAndDelete(req.params.id);
  if (!shop) return res.status(404).json({ success: false, message: 'Shop not found' });
  res.json({ success: true, message: 'Shop deleted successfully' });
};

module.exports = { getShops, getShop, createShop, updateShop, deleteShop, getShopStock, getLiveStock };
