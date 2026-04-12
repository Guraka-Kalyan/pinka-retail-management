const CounterCash = require('../models/CounterCash.model');
const Sale = require('../models/Sale.model');

// @desc   Get counter cash for a shop on a specific date
// @route  GET /api/shops/:shopId/counter-cash
const getCounterCash = async (req, res) => {
  const { date } = req.query;
  const query = { shopId: req.params.shopId };
  if (date) query.date = date;

  const record = await CounterCash.findOne(query).sort({ date: -1 });

  if (!record) {
    return res.json({ success: true, data: null, message: 'No counter cash set for today' });
  }

  // Calculate cash sales dynamically
  const salesQuery = { shopId: req.params.shopId, deletedAt: null };
  if (date) salesQuery.date = date;
  const sales = await Sale.find(salesQuery);
  const cashSales = sales.reduce((sum, s) => sum + (s.cash || 0), 0);
  const counterTotal = record.openingCash + cashSales;

  res.json({
    success: true,
    data: {
      ...record.toObject(),
      cashSales,
      counterTotal,
    },
  });
};

// @desc   Set or update opening cash for a shop on a date
// @route  POST /api/shops/:shopId/counter-cash
const setCounterCash = async (req, res) => {
  const { date, openingCash, finalCash } = req.body;
  if (!date) {
    return res.status(400).json({ success: false, message: 'date is required' });
  }

  const updatePayload = { shopId: req.params.shopId, date };
  if (openingCash !== undefined) updatePayload.openingCash = Number(openingCash);
  if (finalCash !== undefined) updatePayload.finalCash = Number(finalCash);

  // Upsert: one record per shop per day
  const record = await CounterCash.findOneAndUpdate(
    { shopId: req.params.shopId, date },
    { $set: updatePayload },
    { upsert: true, new: true }
  );

  res.status(201).json({ success: true, data: record });
};

// @desc   Get full counter cash history for a shop (all records, sorted desc)
// @route  GET /api/shops/:shopId/counter-cash/history
const getCounterCashHistory = async (req, res) => {
  const { limit = 60 } = req.query;
  const records = await CounterCash.find({ shopId: req.params.shopId })
    .sort({ date: -1 })
    .limit(Number(limit));

  // For each record, also pull cash sales from that day
  const Sale = require('../models/Sale.model');
  const enriched = await Promise.all(records.map(async (r) => {
    const sales = await Sale.find({ shopId: req.params.shopId, date: r.date, deletedAt: null });
    const cashSales = sales.reduce((sum, s) => sum + (s.cash || 0), 0);
    const phonePeSales = sales.reduce((sum, s) => sum + (s.phonePe || 0), 0);
    const totalSales = sales.reduce((sum, s) => sum + (s.total || 0), 0);
    return {
      ...r.toObject(),
      cashSales,
      phonePeSales,
      totalSales,
      counterTotal: r.openingCash + cashSales,
    };
  }));

  res.json({ success: true, data: enriched });
};

module.exports = { getCounterCash, setCounterCash, getCounterCashHistory };
