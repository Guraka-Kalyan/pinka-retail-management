const mongoose = require('mongoose');
const Sale = require('../models/Sale.model');
const DailyCost = require('../models/DailyCost.model');
const ShopInventory = require('../models/ShopInventory.model');
const CentralInventory = require('../models/CentralInventory.model');
const CounterCash = require('../models/CounterCash.model');
const Shop = require('../models/Shop.model');

// @desc   Sales summary
// @route  GET /api/reports/sales-summary
// OPTIMIZED: Single $group aggregation replaces .find() + 9x .reduce() calls in Node.js
const getSalesSummary = async (req, res) => {
  const { shopId, from, to } = req.query;
  const match = { deletedAt: null };
  if (shopId) match.shopId = new mongoose.Types.ObjectId(shopId);
  if (from && to) match.date = { $gte: from, $lte: to };

  const [result] = await Sale.aggregate([
    { $match: match },
    { $group: {
        _id:          null,
        totalRevenue: { $sum: '$total' },
        totalCash:    { $sum: '$cash' },
        totalPhonePe: { $sum: '$phonePe' },
        totalDiscount:{ $sum: '$discountGiven' },
        boneSold:     { $sum: '$boneSold' },
        bonelessSold: { $sum: '$bonelessSold' },
        frySold:      { $sum: '$frySold' },
        currySold:    { $sum: '$currySold' },
        mixedSold:    { $sum: '$mixedSold' },
        totalBills:   { $sum: 1 },
    }},
  ]);

  const d = result || {
    totalRevenue: 0, totalCash: 0, totalPhonePe: 0, totalDiscount: 0,
    boneSold: 0, bonelessSold: 0, frySold: 0, currySold: 0, mixedSold: 0, totalBills: 0,
  };

  res.json({
    success: true,
    data: {
      totalRevenue:  d.totalRevenue,
      totalCash:     d.totalCash,
      totalPhonePe:  d.totalPhonePe,
      totalDiscount: d.totalDiscount,
      totalBills:    d.totalBills,
      breakdown: {
        boneSold:     d.boneSold,
        bonelessSold: d.bonelessSold,
        frySold:      d.frySold,
        currySold:    d.currySold,
        mixedSold:    d.mixedSold,
      },
    },
  });
};

// @desc   Cost summary
// @route  GET /api/reports/costs-summary
// OPTIMIZED: Single $group aggregation replaces .find() + 6x .reduce() calls.
// Uses $reduce expression to handle nested otherCosts array inside the pipeline.
const getCostsSummary = async (req, res) => {
  const { shopId, month } = req.query;
  const match = { deletedAt: null };
  if (shopId) match.shopId = new mongoose.Types.ObjectId(shopId);
  if (month) match.date = { $gte: `${month}-01`, $lte: `${month}-31` };

  const [result] = await DailyCost.aggregate([
    { $match: match },
    { $group: {
        _id:            null,
        grandTotal:     { $sum: '$total' },
        totalLabour:    { $sum: '$labour' },
        totalTransport: { $sum: '$transport' },
        totalIce:       { $sum: '$ice' },
        totalMisc:      { $sum: '$misc' },
        // $reduce handles the nested otherCosts array without a separate $unwind stage
        totalOther: {
          $sum: {
            $reduce: {
              input: '$otherCosts',
              initialValue: 0,
              in: { $add: ['$$value', { $ifNull: ['$$this.amount', 0] }] },
            },
          },
        },
        records: { $sum: 1 },
    }},
  ]);

  const d = result || {
    grandTotal: 0, totalLabour: 0, totalTransport: 0,
    totalIce: 0, totalMisc: 0, totalOther: 0, records: 0,
  };

  res.json({
    success: true,
    data: {
      grandTotal: d.grandTotal,
      breakdown: {
        totalLabour:    d.totalLabour,
        totalTransport: d.totalTransport,
        totalIce:       d.totalIce,
        totalMisc:      d.totalMisc,
        totalOther:     d.totalOther,
      },
      records: d.records,
    },
  });
};

// @desc   Inventory summary
// @route  GET /api/reports/inventory-summary
// OPTIMIZED: $group aggregation replaces .find() + multiple .reduce() calls.
// CentralInventory uses nested field paths (bone.qty) directly in $sum.
const getInventorySummary = async (req, res) => {
  const { shopId } = req.query;

  if (shopId) {
    const [result] = await ShopInventory.aggregate([
      { $match: { shopId: new mongoose.Types.ObjectId(shopId) } },
      { $group: {
          _id:        null,
          bone:       { $sum: '$bone' },
          boneless:   { $sum: '$boneless' },
          mixed:      { $sum: '$mixed' },
          totalValue: { $sum: '$totalAmount' },
      }},
    ]);
    const d = result || { bone: 0, boneless: 0, mixed: 0, totalValue: 0 };
    return res.json({ success: true, data: { bone: d.bone, boneless: d.boneless, mixed: d.mixed, totalValue: d.totalValue } });
  }

  // Central inventory summary — bone.qty / boneless.qty / mixed.qty are nested fields
  const [result] = await CentralInventory.aggregate([
    { $group: {
        _id:        null,
        bone:       { $sum: '$bone.qty' },
        boneless:   { $sum: '$boneless.qty' },
        mixed:      { $sum: '$mixed.qty' },
        skin:       { $sum: '$skin.qty' },
        meat:       { $sum: '$meat.qty' },
        totalValue: { $sum: '$totalAmount' },
    }},
  ]);
  const d = result || { bone: 0, boneless: 0, mixed: 0, skin: 0, meat: 0, totalValue: 0 };
  res.json({ success: true, data: { bone: d.bone, boneless: d.boneless, mixed: d.mixed, skin: d.skin, meat: d.meat, totalValue: d.totalValue } });
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
