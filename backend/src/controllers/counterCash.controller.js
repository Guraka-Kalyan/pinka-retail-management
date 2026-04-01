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
  const { date, openingCash } = req.body;
  if (!date || openingCash === undefined) {
    return res.status(400).json({ success: false, message: 'date and openingCash are required' });
  }

  // Upsert: one record per shop per day
  const record = await CounterCash.findOneAndUpdate(
    { shopId: req.params.shopId, date },
    { shopId: req.params.shopId, date, openingCash: Number(openingCash) },
    { upsert: true, new: true }
  );

  res.status(201).json({ success: true, data: record });
};

module.exports = { getCounterCash, setCounterCash };
