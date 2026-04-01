const Shop = require('../models/Shop.model');

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

module.exports = { getShops, getShop, createShop, updateShop, deleteShop };
