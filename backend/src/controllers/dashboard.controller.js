const Shop = require('../models/Shop.model');
const Sale = require('../models/Sale.model');
const DailyCost = require('../models/DailyCost.model');
const CentralInventory = require('../models/CentralInventory.model');
const Batch = require('../models/Batch.model');
const ShopNote = require('../models/ShopNote.model');
const CounterCash = require('../models/CounterCash.model');

// @desc   Get dashboard summary
// @route  GET /api/dashboard/summary
const getDashboardSummary = async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const thisMonthStart = today.substring(0, 7) + '-01';

  const [
    totalShops,
    totalBatches,
    todaySales,
    monthSales,
    monthCosts,
    centralInventory,
    recentNotes,
    todayCounterCashes,
  ] = await Promise.all([
    Shop.countDocuments(),
    Batch.countDocuments(),
    Sale.find({ date: today, deletedAt: null }),
    Sale.find({ date: { $gte: thisMonthStart, $lte: today }, deletedAt: null }),
    DailyCost.find({ date: { $gte: thisMonthStart, $lte: today }, deletedAt: null }),
    CentralInventory.find(),
    ShopNote.find().populate('shopId', 'name').sort({ createdAt: -1 }).limit(5),
    CounterCash.find({ date: today }),
  ]);

  const todayRevenue = todaySales.reduce((s, r) => s + (r.total || 0), 0);
  const todayCash = todaySales.reduce((s, r) => s + (r.cash || 0), 0);
  const todayPhonePe = todaySales.reduce((s, r) => s + (r.phonePe || 0), 0);
  const monthRevenue = monthSales.reduce((s, r) => s + (r.total || 0), 0);
  const monthCostTotal = monthCosts.reduce((s, r) => s + (r.total || 0), 0);
  const netProfit = monthRevenue - monthCostTotal;

  const centralBone = centralInventory.reduce((s, r) => s + (r.bone?.qty || 0), 0);
  const centralBoneless = centralInventory.reduce((s, r) => s + (r.boneless?.qty || 0), 0);
  const centralMixed = centralInventory.reduce((s, r) => s + (r.mixed?.qty || 0), 0);
  const centralTotalWeight = centralBone + centralBoneless + centralMixed;
  const isLowStock = centralTotalWeight < 5;

  res.json({
    success: true,
    data: {
      shops: totalShops,
      batches: totalBatches,
      today: {
        revenue: todayRevenue,
        cash: todayCash,
        phonePe: todayPhonePe,
        bills: todaySales.length,
      },
      thisMonth: {
        revenue: monthRevenue,
        costs: monthCostTotal,
        netProfit,
      },
      centralInventory: {
        bone: centralBone,
        boneless: centralBoneless,
        mixed: centralMixed,
        totalWeight: centralTotalWeight,
        isLowStock,
      },
      recentNotes,
    },
  });
};

module.exports = { getDashboardSummary };
