const Sale = require('../models/Sale.model');
const DailyCost = require('../models/DailyCost.model');
const ShopInventory = require('../models/ShopInventory.model');
const CentralInventory = require('../models/CentralInventory.model');
const CounterCash = require('../models/CounterCash.model');
const Shop = require('../models/Shop.model');

// @desc   Sales summary
// @route  GET /api/reports/sales-summary
const getSalesSummary = async (req, res) => {
  const { shopId, from, to } = req.query;
  const query = { deletedAt: null };
  if (shopId) query.shopId = shopId;
  if (from && to) query.date = { $gte: from, $lte: to };

  const sales = await Sale.find(query);

  const totalCash = sales.reduce((s, r) => s + (r.cash || 0), 0);
  const totalPhonePe = sales.reduce((s, r) => s + (r.phonePe || 0), 0);
  const totalRevenue = sales.reduce((s, r) => s + (r.total || 0), 0);
  const totalDiscount = sales.reduce((s, r) => s + (r.discountGiven || 0), 0);
  const boneSold = sales.reduce((s, r) => s + (r.boneSold || 0), 0);
  const bonelessSold = sales.reduce((s, r) => s + (r.bonelessSold || 0), 0);
  const frySold = sales.reduce((s, r) => s + (r.frySold || 0), 0);
  const currySold = sales.reduce((s, r) => s + (r.currySold || 0), 0);
  const mixedSold = sales.reduce((s, r) => s + (r.mixedSold || 0), 0);

  res.json({
    success: true,
    data: {
      totalRevenue,
      totalCash,
      totalPhonePe,
      totalDiscount,
      totalBills: sales.length,
      breakdown: { boneSold, bonelessSold, frySold, currySold, mixedSold },
    },
  });
};

// @desc   Cost summary
// @route  GET /api/reports/costs-summary
const getCostsSummary = async (req, res) => {
  const { shopId, month } = req.query;
  const query = { deletedAt: null };
  if (shopId) query.shopId = shopId;
  if (month) query.date = { $gte: `${month}-01`, $lte: `${month}-31` };

  const costs = await DailyCost.find(query);

  const totalLabour = costs.reduce((s, c) => s + (c.labour || 0), 0);
  const totalTransport = costs.reduce((s, c) => s + (c.transport || 0), 0);
  const totalIce = costs.reduce((s, c) => s + (c.ice || 0), 0);
  const totalMisc = costs.reduce((s, c) => s + (c.misc || 0), 0);
  const totalOther = costs.reduce((s, c) => s + c.otherCosts.reduce((ss, o) => ss + (o.amount || 0), 0), 0);
  const grandTotal = costs.reduce((s, c) => s + (c.total || 0), 0);

  res.json({
    success: true,
    data: {
      grandTotal,
      breakdown: { totalLabour, totalTransport, totalIce, totalMisc, totalOther },
      records: costs.length,
    },
  });
};

// @desc   Inventory summary
// @route  GET /api/reports/inventory-summary
const getInventorySummary = async (req, res) => {
  const { shopId } = req.query;

  if (shopId) {
    const records = await ShopInventory.find({ shopId });
    const bone = records.reduce((s, r) => s + (r.bone || 0), 0);
    const boneless = records.reduce((s, r) => s + (r.boneless || 0), 0);
    const mixed = records.reduce((s, r) => s + (r.mixed || 0), 0);
    const totalValue = records.reduce((s, r) => s + (r.totalAmount || 0), 0);
    return res.json({ success: true, data: { bone, boneless, mixed, totalValue } });
  }

  // Central inventory summary
  const central = await CentralInventory.find();
  const bone = central.reduce((s, r) => s + (r.bone || 0), 0);
  const boneless = central.reduce((s, r) => s + (r.boneless || 0), 0);
  const mixed = central.reduce((s, r) => s + (r.mixed || 0), 0);
  const skin = central.reduce((s, r) => s + (r.skin || 0), 0);
  const meat = central.reduce((s, r) => s + (r.meat || 0), 0);
  const totalValue = central.reduce((s, r) => s + (r.totalAmount || 0), 0);

  res.json({ success: true, data: { bone, boneless, mixed, skin, meat, totalValue } });
};

// @desc   Counter cash summary
// @route  GET /api/reports/counter-cash-summary
const getCounterCashSummary = async (req, res) => {
  const { shopId, from, to } = req.query;
  const query = {};
  if (shopId) query.shopId = shopId;
  if (from && to) query.date = { $gte: from, $lte: to };

  const records = await CounterCash.find(query);
  const totalOpening = records.reduce((s, r) => s + (r.openingCash || 0), 0);

  res.json({ success: true, data: { totalOpening, records: records.length } });
};

module.exports = { getSalesSummary, getCostsSummary, getInventorySummary, getCounterCashSummary };
