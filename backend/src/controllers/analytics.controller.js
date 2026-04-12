const mongoose = require('mongoose');
const Sale = require('../models/Sale.model');
const DailyCost = require('../models/DailyCost.model');
const ShopInventory = require('../models/ShopInventory.model');
const Shop = require('../models/Shop.model');
const Preparation = require('../models/Preparation.model');
const CentralInventory = require('../models/CentralInventory.model');
const InventorySupply = require('../models/InventorySupply.model');
const Settings = require('../models/Settings.model');
const Batch = require('../models/Batch.model');

exports.getAnalytics = async (req, res) => {
  try {
    const { from, to, shopId } = req.query;

    const query = { deletedAt: null };
    const dateQuery = {};
    if (from && to) {
      dateQuery.date = { $gte: from, $lte: to };
    } else if (from) {
      dateQuery.date = { $gte: from };
    } else if (to) {
      dateQuery.date = { $lte: to };
    }

    const matchShop = shopId && shopId !== 'all' ? new mongoose.Types.ObjectId(shopId) : null;

    const saleQuery = { ...query, ...dateQuery };
    const costQuery = { ...query, ...dateQuery };
    // ShopInventory and Preparation don't use deletedAt in original queries
    const invQuery = { ...dateQuery }; 
    const prepQuery = { ...dateQuery }; 

    if (matchShop) {
      saleQuery.shopId = matchShop;
      costQuery.shopId = matchShop;
      invQuery.shopId = matchShop;
      prepQuery.shopId = matchShop;
    }

    // ── Get Base Reference Data ──────────────────────────────────────────────
    const [allShops, central] = await Promise.all([
      Shop.find().select('_id name location deletedAt'),
      CentralInventory.find()
    ]);

    // Initialize mapping
    const shopMetrics = {};
    allShops.forEach(s => {
      shopMetrics[s._id.toString()] = {
        shopId: s._id.toString(),
        shopName: s.deletedAt ? `${s.name} (Deleted)` : s.name,
        revenue: 0, kgSold: 0, bills: 0, pendingStock: 0, discount: 0, status: "Good",
        costs: 0, purchaseCost: 0, externalCost: 0,
        boneIn: 0, bonelessIn: 0, mixedIn: 0,
        boneSold: 0, bonelessSold: 0, mixedSold: 0,
        boneUsed: 0, bonelessUsed: 0,
        fryPrepared: 0, curryPrepared: 0,
        bonePending: 0, bonelessPending: 0, mixedPending: 0
      };
    });

    const overallSummary = {
      grossSales: 0, discountGiven: 0, netRevenue: 0,
      purchaseCost: 0, operationalCost: 0, externalCost: 0, totalCost: 0, profit: 0,
      totalKgSold: 0, warehouseStock: 0, pendingStock: 0,
      cashCollection: 0, phonePeCollection: 0,
      activeShops: allShops.filter(s => !s.deletedAt).length
    };

    overallSummary.warehouseStock = central.reduce((sum, c) => sum + (c.totalWeight || 0), 0);

    const salesByMeat = [
      { meatType: "Bone", kgSold: 0, revenue: 0 },
      { meatType: "Boneless", kgSold: 0, revenue: 0 },
      { meatType: "Fry", kgSold: 0, revenue: 0 },
      { meatType: "Curry", kgSold: 0, revenue: 0 },
      { meatType: "Mixed", kgSold: 0, revenue: 0 }
    ];

    // ── Execute Aggregations Concurrently ──────────────────────────────────
    const [salesOverview, dailySalesAgg, costsAgg, invAgg, prepAgg] = await Promise.all([
      Sale.aggregate([
        { $match: saleQuery },
        { $group: {
            _id: "$shopId",
            netRevenue: { $sum: "$total" },
            cashCollection: { $sum: "$cash" },
            phonePeCollection: { $sum: "$phonePe" },
            discountGiven: { $sum: "$discountGiven" },
            boneSold: { $sum: "$boneSold" },
            bonelessSold: { $sum: "$bonelessSold" },
            frySold: { $sum: "$frySold" },
            currySold: { $sum: "$currySold" },
            mixedSold: { $sum: "$mixedSold" },
            bills: { $sum: 1 }
        }}
      ]),
      Sale.aggregate([
        { $match: saleQuery },
        { $group: {
            _id: { date: "$date", shopId: "$shopId" },
            boneSold: { $sum: "$boneSold" },
            bonelessSold: { $sum: "$bonelessSold" },
            frySold: { $sum: "$frySold" },
            currySold: { $sum: "$currySold" },
            mixedSold: { $sum: "$mixedSold" },
            total: { $sum: "$total" }
        }},
        { $sort: { "_id.date": -1 } }
      ]),
      DailyCost.aggregate([
        { $match: costQuery },
        { $group: { _id: "$shopId", costs: { $sum: "$total" } } }
      ]),
      ShopInventory.aggregate([
        { $match: invQuery },
        { $group: {
            _id: { shopId: "$shopId", type: "$type" },
            boneIn: { $sum: "$bone" },
            bonelessIn: { $sum: "$boneless" },
            mixedIn: { $sum: "$mixed" },
            totalAmount: { $sum: "$totalAmount" }
        }}
      ]),
      Preparation.aggregate([
        { $match: prepQuery },
        { $group: {
            _id: "$shopId",
            fryPrepared: { $sum: "$fryOutput" },
            curryPrepared: { $sum: "$curryOutput" },
            boneUsed: { $sum: "$boneUsed" },
            bonelessUsed: { $sum: "$bonelessUsed" }
        }}
      ])
    ]);

    // ── Process Aggregation Results ────────────────────────────────────────

    // 1. Sales
    salesOverview.forEach(s => {
      const sid = s._id?.toString();
      if (!sid || !shopMetrics[sid]) return;

      const kgSold = (s.boneSold || 0) + (s.bonelessSold || 0) + (s.frySold || 0) + (s.currySold || 0) + (s.mixedSold || 0);

      overallSummary.grossSales      += (s.netRevenue + (s.discountGiven || 0));
      overallSummary.discountGiven   += (s.discountGiven || 0);
      overallSummary.netRevenue      += (s.netRevenue || 0);
      overallSummary.cashCollection  += (s.cashCollection || 0);
      overallSummary.phonePeCollection += (s.phonePeCollection || 0);
      overallSummary.totalKgSold     += kgSold;

      shopMetrics[sid].revenue  += (s.netRevenue || 0);
      shopMetrics[sid].kgSold   += kgSold;
      shopMetrics[sid].bills    += (s.bills || 0);
      shopMetrics[sid].discount += (s.discountGiven || 0);

      shopMetrics[sid].boneSold     += (s.boneSold || 0);
      shopMetrics[sid].bonelessSold += (s.bonelessSold || 0);
      shopMetrics[sid].mixedSold    += (s.mixedSold || 0);

      salesByMeat[0].kgSold += (s.boneSold || 0);
      salesByMeat[1].kgSold += (s.bonelessSold || 0);
      salesByMeat[2].kgSold += (s.frySold || 0);
      salesByMeat[3].kgSold += (s.currySold || 0);
      salesByMeat[4].kgSold += (s.mixedSold || 0);
    });

    // 2. Daily Sales Log (Summarized per day per shop)
    const dailySalesLog = dailySalesAgg
      .filter(day => day._id.shopId && shopMetrics[day._id.shopId.toString()])
      .map(day => {
        const sid = day._id.shopId.toString();
        return {
          date: day._id.date,
          shopName: shopMetrics[sid].shopName,
          billId: "-", // Maintained structural compatibility, but signifies summary
          boneSold: day.boneSold || 0,
          bonelessSold: day.bonelessSold || 0,
          frySold: day.frySold || 0,
          currySold: day.currySold || 0,
          mixedSold: day.mixedSold || 0,
          total: day.total || 0
        };
      });

    // 3. Operational Costs
    costsAgg.forEach(c => {
      const sid = c._id?.toString();
      const amount = c.costs || 0;
      overallSummary.operationalCost += amount;
      if (sid && shopMetrics[sid]) {
        shopMetrics[sid].costs += amount;
      }
    });

    // 4. Inventory
    invAgg.forEach(inv => {
      const sid = inv._id.shopId?.toString();
      const type = inv._id.type; // 'central' or 'external'
      if (!sid || !shopMetrics[sid]) return;

      shopMetrics[sid].boneIn     += (inv.boneIn || 0);
      shopMetrics[sid].bonelessIn += (inv.bonelessIn || 0);
      shopMetrics[sid].mixedIn    += (inv.mixedIn || 0);

      const amount = inv.totalAmount || 0;
      if (type === 'external') {
        shopMetrics[sid].externalCost    += amount;
        overallSummary.externalCost      += amount;
      } else {
        shopMetrics[sid].purchaseCost    += amount;
        overallSummary.purchaseCost      += amount;
      }
    });

    // 5. Preparations
    prepAgg.forEach(p => {
      const sid = p._id?.toString();
      if (sid && shopMetrics[sid]) {
        shopMetrics[sid].fryPrepared    += (p.fryPrepared || 0);
        shopMetrics[sid].curryPrepared  += (p.curryPrepared || 0);
        shopMetrics[sid].boneUsed       += (p.boneUsed || 0);
        shopMetrics[sid].bonelessUsed   += (p.bonelessUsed || 0);
      }
    });

    // ── Compute Final Pending Stock & Shop Status ────────────────────────────
    let totalPendingAllShops = 0;
    const shopList = Object.values(shopMetrics).filter(sm =>
      sm.revenue > 0 || sm.boneIn > 0 || sm.bonelessIn > 0 || sm.mixedIn > 0 || sm.costs > 0 || sm.externalCost > 0
    );

    const sortedByRevenue = [...shopList].sort((a,b) => b.revenue - a.revenue);
    const topShopId    = sortedByRevenue.length > 0 ? sortedByRevenue[0].shopId : null;
    const bottomShopId = sortedByRevenue.length > 1 ? sortedByRevenue[sortedByRevenue.length - 1].shopId : null;

    shopList.forEach(sm => {
      sm.bonePending     = Math.max(0, sm.boneIn     - (sm.boneSold + sm.boneUsed));
      sm.bonelessPending = Math.max(0, sm.bonelessIn - (sm.bonelessSold + sm.bonelessUsed));
      sm.mixedPending    = Math.max(0, sm.mixedIn    - sm.mixedSold);
      sm.pendingStock    = sm.bonePending + sm.bonelessPending + sm.mixedPending;
      totalPendingAllShops += sm.pendingStock;

      if (sm.shopId === topShopId)         sm.status = "Top";
      else if (sm.shopId === bottomShopId) sm.status = "Needs Attention";
      else                                  sm.status = "Good";
    });

    overallSummary.pendingStock    = totalPendingAllShops;
    overallSummary.totalCost       = overallSummary.purchaseCost + overallSummary.operationalCost + overallSummary.externalCost;
    overallSummary.profit          = overallSummary.netRevenue - overallSummary.totalCost;

    const inventoryMonitoring = shopList.map(sm => {
      let invStatus = "Good";
      if (sm.pendingStock > 50) invStatus = "Critical";
      else if (sm.pendingStock > 20) invStatus = "Moderate";

      return {
        shopId: sm.shopId,
        shopName: sm.shopName,
        boneIn: sm.boneIn,
        bonelessIn: sm.bonelessIn,
        mixedIn: sm.mixedIn,
        boneSold: sm.boneSold,
        bonelessSold: sm.bonelessSold,
        mixedSold: sm.mixedSold,
        bonePending: sm.bonePending,
        bonelessPending: sm.bonelessPending,
        mixedPending: sm.mixedPending,
        pendingStock: sm.pendingStock,
        status: invStatus
      };
    });

    const preparations = shopList.map(sm => ({
      shopId: sm.shopId,
      shopName: sm.shopName,
      fryPrepared: sm.fryPrepared,
      curryPrepared: sm.curryPrepared,
      boneUsed: sm.boneUsed,
      bonelessUsed: sm.bonelessUsed
    }));

    res.status(200).json({
      success: true,
      data: {
        overallSummary,
        salesByMeatType: salesByMeat,
        shopPerformance: shopList.map(sm => ({
          shopId: sm.shopId,
          shopName: sm.shopName,
          revenue: sm.revenue,
          kgSold: sm.kgSold,
          bills: sm.bills,
          pendingStock: sm.pendingStock,
          discount: sm.discount,
          costs: sm.costs,
          externalCost: sm.externalCost,
          status: sm.status
        })),
        inventoryMonitoring,
        preparations,
        dailySalesLog
      }
    });

  } catch (error) {
    console.error('getAnalytics Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server Error occurred while fetching analytics.', 
      error: error.message 
    });
  }
};
