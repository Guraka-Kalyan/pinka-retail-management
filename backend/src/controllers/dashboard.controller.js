const Shop = require('../models/Shop.model');
const Sale = require('../models/Sale.model');
const DailyCost = require('../models/DailyCost.model');
const CentralInventory = require('../models/CentralInventory.model');
const Batch = require('../models/Batch.model');
const ShopNote = require('../models/ShopNote.model');
// CounterCash removed — was fetched but never used in the response

// @desc   Get dashboard summary
// @route  GET /api/dashboard/summary
// OPTIMIZED: Replaced 4x .find() + 7x .reduce() calls with 4 concurrent $group aggregations.
// Also removed unused CounterCash.find() query that was fetched but never included in response.
const getDashboardSummary = async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const thisMonthStart = today.substring(0, 7) + '-01';

  const [
    totalShops,
    totalBatches,
    todaySalesAgg,
    monthSalesAgg,
    monthCostsAgg,
    centralAgg,
    recentNotes,
  ] = await Promise.all([
    Shop.countDocuments(),
    Batch.countDocuments(),
    // Aggregate today's revenue/cash/phonePe/bills — no document transfer needed
    Sale.aggregate([
      { $match: { date: today, deletedAt: null } },
      { $group: {
          _id:     null,
          revenue: { $sum: '$total' },
          cash:    { $sum: '$cash' },
          phonePe: { $sum: '$phonePe' },
          bills:   { $sum: 1 },
      }},
    ]),
    // Aggregate this month's revenue only
    Sale.aggregate([
      { $match: { date: { $gte: thisMonthStart, $lte: today }, deletedAt: null } },
      { $group: { _id: null, revenue: { $sum: '$total' } } },
    ]),
    // Aggregate this month's costs only
    DailyCost.aggregate([
      { $match: { date: { $gte: thisMonthStart, $lte: today }, deletedAt: null } },
      { $group: { _id: null, total: { $sum: '$total' } } },
    ]),
    // Aggregate central inventory totals — no full document scan needed
    CentralInventory.aggregate([
      { $group: {
          _id:      null,
          bone:     { $sum: '$bone.qty' },
          boneless: { $sum: '$boneless.qty' },
          mixed:    { $sum: '$mixed.qty' },
      }},
    ]),
    ShopNote.find().populate('shopId', 'name').sort({ createdAt: -1 }).limit(5),
  ]);

  const today_   = todaySalesAgg[0]  || { revenue: 0, cash: 0, phonePe: 0, bills: 0 };
  const month_   = monthSalesAgg[0]  || { revenue: 0 };
  const costs_   = monthCostsAgg[0]  || { total: 0 };
  const central_ = centralAgg[0]     || { bone: 0, boneless: 0, mixed: 0 };

  const centralTotalWeight = central_.bone + central_.boneless + central_.mixed;
  const netProfit = month_.revenue - costs_.total;

  res.json({
    success: true,
    data: {
      shops:   totalShops,
      batches: totalBatches,
      today: {
        revenue: today_.revenue,
        cash:    today_.cash,
        phonePe: today_.phonePe,
        bills:   today_.bills,
      },
      thisMonth: {
        revenue: month_.revenue,
        costs:   costs_.total,
        netProfit,
      },
      centralInventory: {
        bone:        central_.bone,
        boneless:    central_.boneless,
        mixed:       central_.mixed,
        totalWeight: centralTotalWeight,
        isLowStock:  centralTotalWeight < 5,
      },
      recentNotes,
    },
  });
};

module.exports = { getDashboardSummary };
