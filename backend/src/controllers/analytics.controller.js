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

    const saleQuery = { ...query, ...dateQuery };
    const costQuery = { ...query, ...dateQuery };
    const invQuery = { ...dateQuery };
    const prepQuery = { ...dateQuery };
    const supplyQuery = { ...dateQuery };

    if (shopId && shopId !== 'all') {
      saleQuery.shopId = shopId;
      costQuery.shopId = shopId;
      invQuery.shopId = shopId;
      prepQuery.shopId = shopId;
      supplyQuery.shopId = shopId;
    }

    // Getting all shops in system for reference and active shops count.
    const allShops = await Shop.find({ deletedAt: null }).select('_id name');

    const [sales, costs, inventories, preps, central, supplies, batches, globalSettings] = await Promise.all([
      Sale.find(saleQuery).populate('shopId', 'name location'),
      DailyCost.find(costQuery).populate('shopId', 'name location'),
      ShopInventory.find(invQuery).populate('shopId', 'name location'),
      Preparation.find(prepQuery).populate('shopId', 'name location'),
      CentralInventory.find(), // Warehouse total is overall
      InventorySupply.find(supplyQuery),
      Batch.find({ status: 'Packed' }),
      Settings.findOne()
    ]);

    // Product-wise COGS Allocation Logic
    const bonePrice = globalSettings?.bone || 350;
    const bonelessPrice = globalSettings?.boneless || 400;
    const mixedPrice = globalSettings?.mixed || 380;
    const fryPrice = globalSettings?.fry || 280;
    const curryPrice = globalSettings?.curry || 250;

    let totalPurchaseCost = 0;
    let totalUsableWeight = 0;

    batches.forEach(b => {
      const bCost = Number(b.cost) || 0;
      const bUsable = Number(b.usableMeat) || 0;
      
      if (bCost > 0 && bUsable > 0) {
        totalPurchaseCost += bCost;
        totalUsableWeight += bUsable;
      }
    });

    const costPerKg = totalUsableWeight > 0 ? (totalPurchaseCost / totalUsableWeight) : 250; // Default fallback

    // Data structures for response
    const overallSummary = {
      grossSales: 0,
      netRevenue: 0,
      discountGiven: 0,
      purchaseCost: 0,
      operationalCost: 0,
      totalCost: 0,
      profit: 0,
      // Keeping other standard stats
      totalKgSold: 0,
      warehouseStock: 0,
      pendingStock: 0,
      cashCollection: 0,
      phonePeCollection: 0,
      activeShops: allShops.length
    };

    const shopMetrics = {};
    allShops.forEach(s => {
      shopMetrics[s._id.toString()] = {
        shopId: s._id.toString(),
        shopName: s.name,
        revenue: 0,
        kgSold: 0,
        bills: 0,
        pendingStock: 0,
        discount: 0,
        status: "Good",
        costs: 0,
        boneIn: 0, bonelessIn: 0, mixedIn: 0,
        boneSold: 0, bonelessSold: 0, mixedSold: 0,
        boneUsed: 0, bonelessUsed: 0,
        fryPrepared: 0, curryPrepared: 0,
        bonePending: 0, bonelessPending: 0, mixedPending: 0
      };
    });

    const salesByMeat = [
      { meatType: "Bone", kgSold: 0, revenue: 0 },
      { meatType: "Boneless", kgSold: 0, revenue: 0 },
      { meatType: "Fry", kgSold: 0, revenue: 0 },
      { meatType: "Curry", kgSold: 0, revenue: 0 },
      { meatType: "Mixed", kgSold: 0, revenue: 0 }
    ];

    const dailySalesMap = {};

    overallSummary.warehouseStock = central.reduce((sum, c) => sum + (c.totalWeight || 0), 0);

    // Process Sales
    sales.forEach(s => {
      const sid = s.shopId?._id?.toString() || s.shopId?.toString();
      if (!sid || !shopMetrics[sid]) return;

      overallSummary.netRevenue += (s.total || 0);
      overallSummary.cashCollection += (s.cash || 0);
      overallSummary.phonePeCollection += (s.phonePe || 0);
      overallSummary.discountGiven += (s.discountGiven || 0);

      const kgSold = (s.boneSold || 0) + (s.bonelessSold || 0) + (s.frySold || 0) + (s.currySold || 0) + (s.mixedSold || 0);
      overallSummary.totalKgSold += kgSold;

      const saleCOGS = kgSold * costPerKg;
      
      overallSummary.purchaseCost += saleCOGS;

      // Accumulate shop performance
      shopMetrics[sid].revenue += (s.total || 0);
      shopMetrics[sid].kgSold += kgSold;
      shopMetrics[sid].bills += 1;
      shopMetrics[sid].discount += (s.discountGiven || 0);
      
      shopMetrics[sid].boneSold += (s.boneSold || 0);
      shopMetrics[sid].bonelessSold += (s.bonelessSold || 0);
      shopMetrics[sid].mixedSold += (s.mixedSold || 0);

      // Accumulate by meat
      // Since we don't have exact revenue per item in the sale record historically, we approximate using weight proportion if needed, but wait! The user just requested the table. Let's do our best. Actually, we can sum the Kg. If they want revenue we can either leave it 0 or omit it, but let's provide Kg. We'll leave revenue 0.
      salesByMeat[0].kgSold += (s.boneSold || 0);
      salesByMeat[1].kgSold += (s.bonelessSold || 0);
      salesByMeat[2].kgSold += (s.frySold || 0);
      salesByMeat[3].kgSold += (s.currySold || 0);
      salesByMeat[4].kgSold += (s.mixedSold || 0);

      // Daily Log
      if (s.date) {
        if (!dailySalesMap[s.date]) dailySalesMap[s.date] = [];
        dailySalesMap[s.date].push({
          date: s.date,
          shopName: shopMetrics[sid].shopName,
          billId: s.billId || "Unknown",
          boneSold: s.boneSold || 0,
          bonelessSold: s.bonelessSold || 0,
          frySold: s.frySold || 0,
          currySold: s.currySold || 0,
          mixedSold: s.mixedSold || 0,
          total: s.total || 0
        });
      }
    });

    // Process Costs
    costs.forEach(c => {
      overallSummary.operationalCost += (c.total || 0);
      const sid = c.shopId?._id?.toString() || c.shopId?.toString();
      if (sid && shopMetrics[sid]) {
        shopMetrics[sid].costs += (c.total || 0);
      }
    });

    // 

    // Process Inventory
    inventories.forEach(inv => {
      const sid = inv.shopId?._id?.toString() || inv.shopId?.toString();
      if (sid && shopMetrics[sid]) {
        shopMetrics[sid].boneIn += (inv.bone || 0);
        shopMetrics[sid].bonelessIn += (inv.boneless || 0);
        shopMetrics[sid].mixedIn += (inv.mixed || 0);
      }
    });

    // Process Preparations
    preps.forEach(p => {
      const sid = p.shopId?._id?.toString() || p.shopId?.toString();
      if (sid && shopMetrics[sid]) {
        shopMetrics[sid].fryPrepared += (p.fryOutput || 0);
        shopMetrics[sid].curryPrepared += (p.curryOutput || 0);
        shopMetrics[sid].boneUsed += (p.boneUsed || 0);
        shopMetrics[sid].bonelessUsed += (p.bonelessUsed || 0);
      }
    });

    // Compute pending stock
    let totalPendingAllShops = 0;
    const shopList = Object.values(shopMetrics).filter(sm => sm.revenue > 0 || sm.boneIn > 0 || sm.bonelessIn > 0);
    
    // Sort logic for status
    const sortedByRevenue = [...shopList].sort((a,b) => b.revenue - a.revenue);
    const topShopId = sortedByRevenue.length > 0 ? sortedByRevenue[0].shopId : null;
    const bottomShopId = sortedByRevenue.length > 1 ? sortedByRevenue[sortedByRevenue.length - 1].shopId : null;

    shopList.forEach(sm => {
      sm.bonePending = Math.max(0, sm.boneIn - (sm.boneSold + sm.boneUsed));
      sm.bonelessPending = Math.max(0, sm.bonelessIn - (sm.bonelessSold + sm.bonelessUsed));
      sm.mixedPending = Math.max(0, sm.mixedIn - sm.mixedSold);
      sm.pendingStock = sm.bonePending + sm.bonelessPending + sm.mixedPending;
      totalPendingAllShops += sm.pendingStock;
      
      if (sm.shopId === topShopId) {
        sm.status = "Top";
      } else if (sm.shopId === bottomShopId) {
        sm.status = "Needs Attention";
      } else {
        sm.status = "Good";
      }
    });

    overallSummary.pendingStock = totalPendingAllShops;

    overallSummary.grossSales = overallSummary.netRevenue + overallSummary.discountGiven;
    overallSummary.totalCost = overallSummary.purchaseCost + overallSummary.operationalCost;
    overallSummary.profit = overallSummary.netRevenue - overallSummary.totalCost;

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

    // Flatten dailySalesMap
    let dailySalesLog = [];
    Object.keys(dailySalesMap).sort((a,b) => b.localeCompare(a)).forEach(date => {
      dailySalesLog.push(...dailySalesMap[date]);
    });

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
