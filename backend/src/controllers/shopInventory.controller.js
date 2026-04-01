const ShopInventory = require('../models/ShopInventory.model');

// @desc   Get shop inventory
// @route  GET /api/shops/:shopId/inventory-in
const getShopInventory = async (req, res) => {
  const records = await ShopInventory.find({ shopId: req.params.shopId }).sort({ date: -1 });
  res.json({ success: true, data: records });
};

// @desc   Add manual shop inventory entry
// @route  POST /api/shops/:shopId/inventory-in
const createShopInventory = async (req, res) => {
  const { batch, date, transport, bone, boneless, mixed, skin, meat, rate, totalWeight, totalAmount } = req.body;
  if (!batch || !date) {
    return res.status(400).json({ success: false, message: 'batch and date are required' });
  }

  const record = await ShopInventory.create({
    shopId: req.params.shopId,
    batch,
    date,
    transport: transport || '',
    bone: Number(bone) || 0,
    boneless: Number(boneless) || 0,
    mixed: Number(mixed) || 0,
    skin: Number(skin) || 0,
    meat: Number(meat) || 0,
    rate: Number(rate) || 0,
    totalWeight: Number(totalWeight) || 0,
    totalAmount: Number(totalAmount) || 0,
  });

  res.status(201).json({ success: true, data: record });
};

// @desc   Update shop inventory entry
// @route  PUT /api/shops/:shopId/inventory-in/:id
const updateShopInventory = async (req, res) => {
  const record = await ShopInventory.findOneAndUpdate(
    { _id: req.params.id, shopId: req.params.shopId },
    req.body,
    { new: true, runValidators: true }
  );
  if (!record) return res.status(404).json({ success: false, message: 'Record not found' });
  res.json({ success: true, data: record });
};

// @desc   Delete shop inventory entry
// @route  DELETE /api/shops/:shopId/inventory-in/:id
const deleteShopInventory = async (req, res) => {
  const record = await ShopInventory.findOneAndDelete({ _id: req.params.id, shopId: req.params.shopId });
  if (!record) return res.status(404).json({ success: false, message: 'Record not found' });
  res.json({ success: true, message: 'Record deleted' });
};

module.exports = { getShopInventory, createShopInventory, updateShopInventory, deleteShopInventory };
