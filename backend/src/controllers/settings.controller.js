const Settings = require('../models/Settings.model');

// @desc   Get settings (global or per shop)
// @route  GET /api/settings/selling-costs
const getSettings = async (req, res) => {
  const { shopId } = req.query;

  let settings = null;
  if (shopId) {
    settings = await Settings.findOne({ shopId });
  }
  // Fall back to global if no shop-specific setting
  if (!settings) {
    settings = await Settings.findOne({ shopId: null });
  }
  // If none exist at all, return defaults
  if (!settings) {
    settings = { fry: 280, curry: 250, bone: 200, boneless: 400, mixed: 200 };
  }

  res.json({ success: true, data: settings });
};

// @desc   Update or create settings
// @route  PUT /api/settings/selling-costs
const updateSettings = async (req, res) => {
  const { shopId, fry, curry, bone, boneless, mixed } = req.body;

  const settings = await Settings.findOneAndUpdate(
    { shopId: shopId || null },
    { fry: Number(fry) || 280, curry: Number(curry) || 250, bone: Number(bone) || 200, boneless: Number(boneless) || 400, mixed: Number(mixed) || 200 },
    { upsert: true, new: true }
  );

  res.json({ success: true, data: settings });
};

module.exports = { getSettings, updateSettings };
