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
const getLiveStock = async (shopId) => {
  const inventory = await ShopInventory.find({ shopId });
  const preparations = await Preparation.find({ shopId });
  const sales = await Sale.find({ shopId, deletedAt: null });

  const totalBoneIn = inventory.reduce((acc, r) => acc + (r.bone || 0), 0);
  const totalBonelessIn = inventory.reduce((acc, r) => acc + (r.boneless || 0), 0);
  const totalMixedIn = inventory.reduce((acc, r) => acc + (r.mixed || 0), 0);

  const overallBoneSold = sales.reduce((s, r) => s + (Number(r.boneSold) || 0), 0);
  const overallBonelessSold = sales.reduce((s, r) => s + (Number(r.bonelessSold) || 0), 0);
  const overallMixedSold = sales.reduce((s, r) => s + (Number(r.mixedSold) || 0), 0);
  const overallFrySold = sales.reduce((s, r) => s + (Number(r.frySold) || 0), 0);
  const overallCurrySold = sales.reduce((s, r) => s + (Number(r.currySold) || 0), 0);

  const overallBoneUsed = preparations.reduce((s, r) => s + (Number(r.boneUsed) || 0), 0);
  const overallBonelessUsed = preparations.reduce((s, r) => s + (Number(r.bonelessUsed) || 0), 0);

  const totalFryPrep = preparations.reduce((s, r) => s + (Number(r.fryOutput) || 0), 0);
  const totalCurryPrep = preparations.reduce((s, r) => s + (Number(r.curryOutput) || 0), 0);

  return {
    boneStock: totalBoneIn - overallBoneSold - overallBoneUsed,
    bonelessStock: totalBonelessIn - overallBonelessSold - overallBonelessUsed,
    mixedStock: totalMixedIn - overallMixedSold,
    fryStock: totalFryPrep - overallFrySold,
    curryStock: totalCurryPrep - overallCurrySold
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
