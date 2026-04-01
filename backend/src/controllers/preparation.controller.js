const Preparation = require('../models/Preparation.model');

// @desc   Get preparations for a shop
// @route  GET /api/shops/:shopId/preparations
const getPreparations = async (req, res) => {
  const { date } = req.query;
  const query = { shopId: req.params.shopId };
  if (date) query.date = date;

  const records = await Preparation.find(query).sort({ createdAt: -1 });
  res.json({ success: true, data: records });
};

// @desc   Create preparation entry
// @route  POST /api/shops/:shopId/preparations
const createPreparation = async (req, res) => {
  const { date, boneFry, bonelessFry, boneCurry, bonelessCurry, fryOutput, curryOutput } = req.body;
  if (!date) return res.status(400).json({ success: false, message: 'date is required' });

  const boneUsed    = (Number(boneFry)     || 0) + (Number(boneCurry)     || 0);
  const bonelessUsed = (Number(bonelessFry) || 0) + (Number(bonelessCurry) || 0);

  // Auto-generate refId
  const count = await Preparation.countDocuments({ shopId: req.params.shopId });
  const refId = `PREP-${String(count + 1).padStart(3, '0')}`;

  const prep = await Preparation.create({
    shopId:        req.params.shopId,
    date,
    refId,
    boneFry:       Number(boneFry)       || 0,
    bonelessFry:   Number(bonelessFry)   || 0,
    boneCurry:     Number(boneCurry)     || 0,
    bonelessCurry: Number(bonelessCurry) || 0,
    fryOutput:     Number(fryOutput)     || 0,
    curryOutput:   Number(curryOutput)   || 0,
    boneUsed,
    bonelessUsed,
  });

  res.status(201).json({ success: true, data: prep });
};

// @desc   Update preparation entry
// @route  PUT /api/shops/:shopId/preparations/:prepId
const updatePreparation = async (req, res) => {
  const { date, boneFry, bonelessFry, boneCurry, bonelessCurry, fryOutput, curryOutput, boneUsed, bonelessUsed } = req.body;

  // Recalculate totals if raw inputs provided, else use passed values
  const computedBoneUsed    = boneFry    !== undefined ? (Number(boneFry)     || 0) + (Number(boneCurry)     || 0) : boneUsed;
  const computedBonelessUsed = bonelessFry !== undefined ? (Number(bonelessFry) || 0) + (Number(bonelessCurry) || 0) : bonelessUsed;

  const updateFields = {};
  if (date           !== undefined) updateFields.date           = date;
  if (boneFry        !== undefined) updateFields.boneFry        = Number(boneFry)       || 0;
  if (bonelessFry    !== undefined) updateFields.bonelessFry    = Number(bonelessFry)   || 0;
  if (boneCurry      !== undefined) updateFields.boneCurry      = Number(boneCurry)     || 0;
  if (bonelessCurry  !== undefined) updateFields.bonelessCurry  = Number(bonelessCurry) || 0;
  if (fryOutput      !== undefined) updateFields.fryOutput      = Number(fryOutput)     || 0;
  if (curryOutput    !== undefined) updateFields.curryOutput    = Number(curryOutput)   || 0;
  if (computedBoneUsed    !== undefined) updateFields.boneUsed    = computedBoneUsed;
  if (computedBonelessUsed !== undefined) updateFields.bonelessUsed = computedBonelessUsed;

  const prep = await Preparation.findOneAndUpdate(
    { _id: req.params.prepId, shopId: req.params.shopId },
    updateFields,
    { new: true, runValidators: true }
  );

  if (!prep) return res.status(404).json({ success: false, message: 'Preparation record not found' });
  res.json({ success: true, data: prep });
};

// @desc   Delete preparation entry
// @route  DELETE /api/shops/:shopId/preparations/:prepId
const deletePreparation = async (req, res) => {
  const prep = await Preparation.findOneAndDelete({
    _id:    req.params.prepId,
    shopId: req.params.shopId,
  });
  if (!prep) return res.status(404).json({ success: false, message: 'Preparation not found' });
  res.json({ success: true, message: 'Preparation deleted' });
};

module.exports = { getPreparations, createPreparation, updatePreparation, deletePreparation };
