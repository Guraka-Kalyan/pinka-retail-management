const DailyCost = require('../models/DailyCost.model');

// @desc   Get daily costs for a shop
// @route  GET /api/shops/:shopId/daily-costs
const getDailyCosts = async (req, res) => {
  const { month } = req.query; // e.g. "2026-03"
  const query = { shopId: req.params.shopId, deletedAt: null };

  if (month) {
    query.date = { $gte: `${month}-01`, $lte: `${month}-31` };
  }

  const costs = await DailyCost.find(query).sort({ date: -1 });
  res.json({ success: true, data: costs });
};

// @desc   Create daily cost entry
// @route  POST /api/shops/:shopId/daily-costs
const createDailyCost = async (req, res) => {
  const { date, labour, transport, ice, misc, otherCosts, notes } = req.body;
  if (!date) return res.status(400).json({ success: false, message: 'date is required' });

  const fixedTotal = (Number(labour) || 0) + (Number(transport) || 0) + (Number(ice) || 0) + (Number(misc) || 0);
  const otherTotal = Array.isArray(otherCosts) ? otherCosts.reduce((sum, c) => sum + (Number(c.amount) || 0), 0) : 0;
  const total = fixedTotal + otherTotal;

  const cost = await DailyCost.create({
    shopId:     req.params.shopId,
    date,
    labour:     Number(labour)    || 0,
    transport:  Number(transport) || 0,
    ice:        Number(ice)       || 0,
    misc:       Number(misc)      || 0,
    otherCosts: Array.isArray(otherCosts) ? otherCosts : [],
    notes:      notes || '',
    total,
    deletedAt:  null,
  });

  res.status(201).json({ success: true, data: cost });
};

// @desc   Update daily cost entry
// @route  PUT /api/shops/:shopId/daily-costs/:costId
const updateDailyCost = async (req, res) => {
  const { date, labour, transport, ice, misc, otherCosts, notes } = req.body;

  // Verify the record belongs to this shop and is not deleted
  const existing = await DailyCost.findOne({
    _id:       req.params.costId,
    shopId:    req.params.shopId,
    deletedAt: null,
  });
  if (!existing) return res.status(404).json({ success: false, message: 'Cost record not found' });

  // Build updated fields — only recalculate total if cost fields are provided
  const updatedLabour    = labour    !== undefined ? (Number(labour)    || 0) : existing.labour;
  const updatedTransport = transport !== undefined ? (Number(transport) || 0) : existing.transport;
  const updatedIce       = ice       !== undefined ? (Number(ice)       || 0) : existing.ice;
  const updatedMisc      = misc      !== undefined ? (Number(misc)      || 0) : existing.misc;
  const updatedOtherCosts = otherCosts !== undefined ? (Array.isArray(otherCosts) ? otherCosts : []) : existing.otherCosts;

  const fixedTotal = updatedLabour + updatedTransport + updatedIce + updatedMisc;
  const otherTotal = updatedOtherCosts.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
  const total = fixedTotal + otherTotal;

  const updated = await DailyCost.findByIdAndUpdate(
    req.params.costId,
    {
      date:       date      || existing.date,
      labour:     updatedLabour,
      transport:  updatedTransport,
      ice:        updatedIce,
      misc:       updatedMisc,
      otherCosts: updatedOtherCosts,
      notes:      notes !== undefined ? notes : existing.notes,
      total,
    },
    { new: true, runValidators: true }
  );

  res.json({ success: true, data: updated });
};

// @desc   Soft delete daily cost entry
// @route  DELETE /api/shops/:shopId/daily-costs/:costId
const deleteDailyCost = async (req, res) => {
  const cost = await DailyCost.findOneAndUpdate(
    { _id: req.params.costId, shopId: req.params.shopId, deletedAt: null },
    { deletedAt: new Date() },
    { new: true }
  );
  if (!cost) return res.status(404).json({ success: false, message: 'Cost record not found' });
  res.json({ success: true, message: 'Cost record deleted' });
};

module.exports = { getDailyCosts, createDailyCost, updateDailyCost, deleteDailyCost };
