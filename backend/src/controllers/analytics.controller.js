const Sale = require('../models/Sale.model');
const DailyCost = require('../models/DailyCost.model');
const ShopInventory = require('../models/ShopInventory.model');
const Shop = require('../models/Shop.model');
const Preparation = require('../models/Preparation.model');

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

    if (shopId && shopId !== 'all') {
      saleQuery.shopId = shopId;
      costQuery.shopId = shopId;
      invQuery.shopId = shopId;
      prepQuery.shopId = shopId;
    }

    const sales = await Sale.find(saleQuery).populate('shopId', 'name location');
    const costs = await DailyCost.find(costQuery).populate('shopId', 'name location');
    const inventories = await ShopInventory.find(invQuery).populate('shopId', 'name location');
    const preps = await Preparation.find(prepQuery).populate('shopId', 'name location');

    // 1. Overall Summary
    const totalSales = sales.reduce((sum, s) => sum + (s.total || 0), 0);
    const totalExpenses = costs.reduce((sum, c) => sum + (c.total || 0), 0);
    const netProfit = totalSales - totalExpenses;
    const totalDiscount = sales.reduce((sum, s) => sum + (s.discountGiven || 0), 0);
    const cashReceived = sales.reduce((sum, s) => sum + (s.cash || 0), 0);
    const phonePeReceived = sales.reduce((sum, s) => sum + (s.phonePe || 0), 0);

    const overallSummary = {
      totalSales,
      totalExpenses,
      netProfit,
      totalDiscount,
      cashReceived,
      phonePeReceived
    };

    // 2. Sales by Meat Type
    const salesByMeatType = {
      boneSold: sales.reduce((sum, s) => sum + (s.boneSold || 0), 0),
      bonelessSold: sales.reduce((sum, s) => sum + (s.bonelessSold || 0), 0),
      mixedSold: sales.reduce((sum, s) => sum + (s.mixedSold || 0), 0),
      frySold: sales.reduce((sum, s) => sum + (s.frySold || 0), 0),
      currySold: sales.reduce((sum, s) => sum + (s.currySold || 0), 0),
    };

    // 3. Shop Performance (grouped by shopId)
    const shopPerformanceMap = {};
    const initShop = (sid, shopDoc) => {
      if (!shopPerformanceMap[sid]) {
        shopPerformanceMap[sid] = {
          shopId: sid,
          shopName: shopDoc?.name || 'Unknown',
          totalSales: 0,
          expenses: 0,
          profit: 0
        };
      }
    };

    sales.forEach(s => {
      const sid = s.shopId?._id?.toString() || s.shopId?.toString();
      if (!sid) return;
      initShop(sid, s.shopId);
      shopPerformanceMap[sid].totalSales += (s.total || 0);
    });

    costs.forEach(c => {
      const sid = c.shopId?._id?.toString() || c.shopId?.toString();
      if (!sid) return;
      initShop(sid, c.shopId);
      shopPerformanceMap[sid].expenses += (c.total || 0);
    });

    const shopPerformance = Object.values(shopPerformanceMap).map(sp => {
      sp.profit = sp.totalSales - sp.expenses;
      return sp;
    });

    // 4. Daily Sales Trend (grouped by date)
    const dailyMap = {};
    sales.forEach(s => {
      if (!s.date) return;
      if (!dailyMap[s.date]) dailyMap[s.date] = 0;
      dailyMap[s.date] += (s.total || 0);
    });
    const dailySalesTrend = Object.keys(dailyMap).map(date => ({
      date,
      totalSales: dailyMap[date]
    })).sort((a,b) => a.date.localeCompare(b.date));

    // 5. Inventory Monitoring (grouped by shop)
    const inventoryMap = {};
    inventories.forEach(inv => {
      const sid = inv.shopId?._id?.toString() || inv.shopId?.toString();
      if (!sid) return;
      if (!inventoryMap[sid]) {
        inventoryMap[sid] = {
          shopId: sid,
          shopName: inv.shopId?.name || 'Unknown',
          bone: 0,
          boneless: 0,
          mixed: 0
        };
      }
      inventoryMap[sid].bone += (inv.bone || 0);
      inventoryMap[sid].boneless += (inv.boneless || 0);
      inventoryMap[sid].mixed += (inv.mixed || 0);
    });
    const inventoryMonitoring = Object.values(inventoryMap);

    // 6. Preparation Summary
    const preparationSummary = {
      fryOutput: preps.reduce((sum, p) => sum + (p.fryOutput || 0), 0),
      curryOutput: preps.reduce((sum, p) => sum + (p.curryOutput || 0), 0),
      boneUsed: preps.reduce((sum, p) => sum + (p.boneUsed || 0), 0),
      bonelessUsed: preps.reduce((sum, p) => sum + (p.bonelessUsed || 0), 0),
    };

    res.status(200).json({
      success: true,
      data: {
        overallSummary,
        salesByMeatType,
        shopPerformance,
        dailySalesTrend,
        inventoryMonitoring,
        preparationSummary
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
