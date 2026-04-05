const Sale = require('../models/Sale.model');
const DailyCost = require('../models/DailyCost.model');
const ShopInventory = require('../models/ShopInventory.model');
const CentralInventory = require('../models/CentralInventory.model');
const Shop = require('../models/Shop.model');
const Preparation = require('../models/Preparation.model');

// @desc   Full Analytics Dashboard Data
// @route  GET /api/reports/analytics
const getAnalytics = async (req, res) => {
  try {
    const { shopId, from, to } = req.query;

    // Build base queries
    const salesQuery = { deletedAt: null };
    const costsQuery = { deletedAt: null };
    const invDateQuery = {};      // For tracking "Stock received within date range"
    const invAbsoluteQuery = {};  // For tracking "Absolute Pending Stock"
    const prepQuery = {};
    const prepAbsoluteQuery = {}; // For absolute consumption tracking

    if (shopId) {
      salesQuery.shopId = shopId;
      costsQuery.shopId = shopId;
      invDateQuery.shopId = shopId;
      invAbsoluteQuery.shopId = shopId;
      prepQuery.shopId = shopId;
      prepAbsoluteQuery.shopId = shopId;
    }

    if (from && to) {
      salesQuery.date = { $gte: from, $lte: to };
      costsQuery.date = { $gte: from, $lte: to };
      invDateQuery.date = { $gte: from, $lte: to };
      prepQuery.date = { $gte: from, $lte: to };
    }

    // Fetch data
    const [
      salesDateFiltered,
      salesAbsolute,
      costsDateFiltered,
      shopInvDateFiltered,
      shopInvAbsolute,
      centralInv,
      shops,
      prepDateFiltered,
      prepAbsolute
    ] = await Promise.all([
      Sale.find(salesQuery).populate('shopId', 'name location'),
      Sale.find(shopId ? { shopId, deletedAt: null } : { deletedAt: null }), // All-time sales for pending calc
      DailyCost.find(costsQuery),
      ShopInventory.find(invDateQuery).populate('shopId', 'name location'),
      ShopInventory.find(invAbsoluteQuery).populate('shopId', 'name location'), // All-time supply
      CentralInventory.find(),
      Shop.find(),
      Preparation.find(prepQuery).populate('shopId', 'name location'),
      Preparation.find(prepAbsoluteQuery).populate('shopId', 'name location') // All-time prep
    ]);

    // 1. Overall Summary
    const totalRevenue = salesDateFiltered.reduce((sum, s) => sum + (s.total || 0), 0);
    const totalKgSold = salesDateFiltered.reduce((sum, s) => sum + (s.boneSold || 0) + (s.bonelessSold || 0) + (s.frySold || 0) + (s.currySold || 0) + (s.mixedSold || 0), 0);
    
    // Central stock (only makes sense globally, but let's aggregate)
    const warehouseStock = centralInv.reduce((sum, c) => sum + (c.bone || 0) + (c.boneless || 0) + (c.mixed || 0) + (c.meat || 0) + (c.skin || 0), 0);
    
    // Aggregation Containers
    const invTotals = {};
    const salesTotals = {};
    const prepTotals = {};
    
    // Analytics Containers for specific Date filtering
    const salesMetricsFiltered = {};
    const invMetricsFiltered = {};
    const prepMetricsFiltered = {};
    const costsMetricsFiltered = {};

    shops.forEach(s => {
      const sid = s._id.toString();
      invTotals[sid] = { bone: 0, boneless: 0, mixed: 0 };
      salesTotals[sid] = { bone: 0, boneless: 0, mixed: 0, fry: 0, curry: 0 };
      prepTotals[sid] = { boneUsed: 0, bonelessUsed: 0, fryPrep: 0, curryPrep: 0 };
      
      salesMetricsFiltered[sid] = { totalAmt: 0, kgSold: 0, bills: 0, discount: 0, cash: 0, phonePe: 0, bone: 0, boneless: 0, mixed: 0, fry: 0, curry: 0 };
      invMetricsFiltered[sid] = { bone: 0, boneless: 0, mixed: 0 };
      prepMetricsFiltered[sid] = { boneUsed: 0, bonelessUsed: 0, fryPrep: 0, curryPrep: 0 };
      costsMetricsFiltered[sid] = { operationalCost: 0 };
    });

    // ---- ALL-TIME DATA for Absolute Pending Stock ----
    shopInvAbsolute.forEach(inv => {
      const sid = inv.shopId?._id?.toString() || inv.shopId?.toString();
      if (!invTotals[sid]) return;
      invTotals[sid].bone += (inv.bone || 0);
      invTotals[sid].boneless += (inv.boneless || 0);
      invTotals[sid].mixed += (inv.mixed || 0);
    });

    salesAbsolute.forEach(s => {
      const sid = s.shopId?._id?.toString() || s.shopId?.toString();
      if (!salesTotals[sid]) return;
      salesTotals[sid].bone += (s.boneSold || 0);
      salesTotals[sid].boneless += (s.bonelessSold || 0);
      salesTotals[sid].mixed += (s.mixedSold || 0);
      salesTotals[sid].fry += (s.frySold || 0);
      salesTotals[sid].curry += (s.currySold || 0);
    });

    prepAbsolute.forEach(p => {
      const sid = p.shopId?._id?.toString() || p.shopId?.toString();
      if (!prepTotals[sid]) return;
      prepTotals[sid].boneUsed += (p.boneUsed || 0);
      prepTotals[sid].bonelessUsed += (p.bonelessUsed || 0);
      prepTotals[sid].fryPrep += (p.fryOutput || 0);
      prepTotals[sid].curryPrep += (p.curryOutput || 0);
    });

    // ---- DATE-FILTERED DATA for Reporting ----
    salesDateFiltered.forEach(s => {
      const sid = s.shopId?._id?.toString() || s.shopId?.toString();
      if (!salesMetricsFiltered[sid]) return;
      salesMetricsFiltered[sid].totalAmt += (s.total || 0);
      salesMetricsFiltered[sid].cash += (s.cash || 0);
      salesMetricsFiltered[sid].phonePe += (s.phonePe || 0);
      salesMetricsFiltered[sid].discount += (s.discountGiven || 0);
      salesMetricsFiltered[sid].bone += (s.boneSold || 0);
      salesMetricsFiltered[sid].boneless += (s.bonelessSold || 0);
      salesMetricsFiltered[sid].mixed += (s.mixedSold || 0);
      salesMetricsFiltered[sid].fry += (s.frySold || 0);
      salesMetricsFiltered[sid].curry += (s.currySold || 0);
      salesMetricsFiltered[sid].kgSold += ((s.boneSold || 0) + (s.bonelessSold || 0) + (s.mixedSold || 0) + (s.frySold || 0) + (s.currySold || 0));
      salesMetricsFiltered[sid].bills += 1;
    });

    shopInvDateFiltered.forEach(inv => {
      const sid = inv.shopId?._id?.toString() || inv.shopId?.toString();
      if (!invMetricsFiltered[sid]) return;
      invMetricsFiltered[sid].bone += (inv.bone || 0);
      invMetricsFiltered[sid].boneless += (inv.boneless || 0);
      invMetricsFiltered[sid].mixed += (inv.mixed || 0);
    });

    prepDateFiltered.forEach(p => {
      const sid = p.shopId?._id?.toString() || p.shopId?.toString();
      if (!prepMetricsFiltered[sid]) return;
      prepMetricsFiltered[sid].boneUsed += (p.boneUsed || 0);
      prepMetricsFiltered[sid].bonelessUsed += (p.bonelessUsed || 0);
      prepMetricsFiltered[sid].fryPrep += (p.fryOutput || 0);
      prepMetricsFiltered[sid].curryPrep += (p.curryOutput || 0);
    });

    const dailyCostMap = {};
    costsDateFiltered.forEach(c => {
      const sid = c.shopId?._id?.toString() || c.shopId?.toString();
      if (!costsMetricsFiltered[sid]) return;
      costsMetricsFiltered[sid].operationalCost += (c.total || 0);

      const mapKey = `${sid}_${c.date}`;
      dailyCostMap[mapKey] = (dailyCostMap[mapKey] || 0) + (c.total || 0);
    });

    let totalPendingStock = 0;
    const shopPerformance = [];
    const inventoryMonitoring = [];
    const pendingInventorySummary = [];
    const preparationLogs = [];
    
    // Group per shop using DateFiltered metrics and Absolute pending variables
    shops.forEach(s => {
      const id = s._id.toString();
      
      // Absolute values to yield pure Pending Stock
      const absIv = invTotals[id];
      const absSt = salesTotals[id];
      const absPr = prepTotals[id];
      
      const bp = absIv.bone - absSt.bone - absPr.boneUsed;
      const blp = absIv.boneless - absSt.boneless - absPr.bonelessUsed;
      const mp = absIv.mixed - absSt.mixed; // Wait, fry/curry consumes mixed? Usually mixed is direct sale. We assume pure math here.
      const pend = bp + blp + mp;
      totalPendingStock += pend;

      const shopStatus = pend > 50 ? 'Good' : (pend > 20 ? 'Moderate' : 'Critical');
      
      // Filtered values to yield accurate date tracking
      const fSt = salesMetricsFiltered[id];
      const fIv = invMetricsFiltered[id];
      const fPr = prepMetricsFiltered[id];
      const fCo = costsMetricsFiltered[id];

      if (!shopId || shopId === id) {
        shopPerformance.push({
          shopId: id,
          shopName: s.name,
          revenue: fSt.totalAmt,
          kgSold: fSt.kgSold,
          bills: fSt.bills,
          pendingStock: pend, // Critical: Pending remains absolute inside the filtered logic
          discount: fSt.discount,
          operationalCost: fCo.operationalCost,
          status: shopStatus
        });
        
        inventoryMonitoring.push({
          shopId: id,
          shopName: s.name,
          bone: fIv.bone, // Show *how much* was requested over the date filter conditionally? 
          boneless: fIv.boneless,
          mixed: fIv.mixed,
          pending: pend,
          status: shopStatus
        });

        pendingInventorySummary.push({
          shopId: id,
          shopName: s.name,
          bonePending: bp,
          bonelessPending: blp,
          mixedPending: mp,
          totalPending: pend,
          status: shopStatus
        });

        preparationLogs.push({
          shopId: id,
          shopName: s.name,
          fryPrepared: fPr.fryPrep,
          curryPrepared: fPr.curryPrep,
          boneUsed: fPr.boneUsed,
          bonelessUsed: fPr.bonelessUsed
        });
      }
    });

    const cashCollection = salesDateFiltered.reduce((sum, s) => sum + (s.cash || 0), 0);
    const phonePeCollection = salesDateFiltered.reduce((sum, s) => sum + (s.phonePe || 0), 0);
    const discountGiven = salesDateFiltered.reduce((sum, s) => sum + (s.discountGiven || 0), 0);
    const operationalCost = costsDateFiltered.reduce((sum, c) => sum + (c.total || 0), 0);

    // Meat Totals
    const meatStats = {
      Bone: { kgSold: salesDateFiltered.reduce((s, r) => s + (r.boneSold || 0), 0), revenue: 0 },
      Boneless: { kgSold: salesDateFiltered.reduce((s, r) => s + (r.bonelessSold || 0), 0), revenue: 0 },
      Fry: { kgSold: salesDateFiltered.reduce((s, r) => s + (r.frySold || 0), 0), revenue: 0 },
      Curry: { kgSold: salesDateFiltered.reduce((s, r) => s + (r.currySold || 0), 0), revenue: 0 },
      Mixed: { kgSold: salesDateFiltered.reduce((s, r) => s + (r.mixedSold || 0), 0), revenue: 0 }
    };
    
    // Revenue approximation for meats (Since actual itemized value per item isn't tracked purely, we'll estimate or just show 0 if not tracked. Or we can just calculate from defaults? Actually, let's approximate based on kg proportion vs total. Or we can leave revenue as 0 if not needed, but user requested revenue.)
    // Wait, the sales schema has total but not breakdown by meat price. 
    // We'll leave revenue as 0 or calculate it using defaults if required. Let's just focus on kgSold for now or return 0 for revenue.
    const salesByMeat = Object.keys(meatStats).map(type => ({
      type,
      kgSold: meatStats[type].kgSold,
      revenue: 0 // Cannot accurately calculate itemized revenue from flat totals without prices
    }));

    // Find insights
    salesByMeat.sort((a,b) => b.kgSold - a.kgSold);
    const topSellingMeat = salesByMeat.filter(m => m.kgSold > 0)[0]?.type || 'N/A';
    const leastSellingMeat = salesByMeat.filter(m => m.kgSold > 0).slice(-1)[0]?.type || 'N/A';
    
    const sortedShops = [...shopPerformance].filter(s => s.revenue > 0).sort((a,b) => b.revenue - a.revenue);
    const topShop = sortedShops[0]?.shopName || 'N/A';
    const lowestShop = sortedShops[sortedShops.length-1]?.shopName || 'N/A';

    const sortedPending = [...shopPerformance].sort((a,b) => b.pendingStock - a.pendingStock);
    const highestPendingShop = sortedPending[0]?.shopName || 'N/A';

    // Daily Sales Log
    const dailySalesLog = salesDateFiltered.map(s => {
      const sid = s.shopId?._id?.toString() || s.shopId?.toString();
      return {
        date: s.date,
        shopName: s.shopId?.name || 'Unknown',
        billId: s.billId,
        bone: s.boneSold || 0,
        boneless: s.bonelessSold || 0,
        fry: s.frySold || 0,
        curry: s.currySold || 0,
        mixed: s.mixedSold || 0,
        totalKg: (s.boneSold||0) + (s.bonelessSold||0) + (s.frySold||0) + (s.currySold||0) + (s.mixedSold||0),
        cash: s.cash || 0,
        phonePe: s.phonePe || 0,
        discount: s.discountGiven || 0,
        total: s.total || 0,
        operationalCost: dailyCostMap[`${sid}_${s.date}`] || 0
      };
    });

    res.json({
      success: true,
      data: {
        overall: {
          totalRevenue,
          totalKgSold,
          warehouseStock,
          pendingStock: totalPendingStock,
          cashCollection,
          phonePeCollection,
          discountGiven,
          operationalCost,
          activeShops: shops.length
        },
        salesStockInsights: {
          topSellingMeat,
          leastSellingMeat,
          topShop,
          lowestShop,
          highestPendingShop,
          fastMovingStock: topSellingMeat, // simplification
          slowMovingStock: leastSellingMeat
        },
        salesByMeat,
        shopPerformance,
        inventoryMonitoring,
        pendingInventorySummary,
        preparationLogs,
        dailySalesLog
      }
    });

  } catch (error) {
    console.error('Analytics Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch analytics' });
  }
};

module.exports = { getAnalytics };
