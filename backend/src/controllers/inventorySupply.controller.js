const InventorySupply = require('../models/InventorySupply.model');
const CentralInventory = require('../models/CentralInventory.model');
const ShopInventory = require('../models/ShopInventory.model');
const Settings = require('../models/Settings.model');

// Fallback prices if no settings configured
const FALLBACK_PRICES = { bone: 350, boneless: 400, mixed: 380, skin: 50, meat: 450 };

// Helper: fetch shop-specific prices, fallback to global, then hardcoded defaults
const getPrices = async (shopId) => {
  if (shopId) {
    const shopSettings = await Settings.findOne({ shopId });
    if (shopSettings) return shopSettings;
  }
  const globalSettings = await Settings.findOne({ shopId: null });
  if (globalSettings) return globalSettings;
  return FALLBACK_PRICES;
};

// @desc   Get all supply records
// @route  GET /api/supplies
const getSupplies = async (req, res) => {
  const supplies = await InventorySupply.find().populate('shopId', 'name').sort({ createdAt: -1 });
  res.json({ success: true, data: supplies });
};

// @desc   Create supply (deduct from central, create shop inventory)
// @route  POST /api/supplies
const createSupply = async (req, res) => {
  const { shopId, batch, bone, boneless, mixed, extra, overrideFlag, date, externalRecipient } = req.body;

  if (!batch || !date) {
    return res.status(400).json({ success: false, message: 'batch and date are required' });
  }

  const nBone     = Number(bone)     || 0;
  const nBoneless = Number(boneless) || 0;
  const nMixed    = Number(mixed)    || 0;
  const nExtra    = Number(extra)    || 0;
  const total     = nBone + nBoneless + nMixed;

  if (total === 0) {
    return res.status(400).json({ success: false, message: 'Enter at least one quantity to supply' });
  }

  // Find central inventory for this batch
  const invItem = await CentralInventory.findOne({ batchNo: batch });
  if (!invItem) {
    return res.status(404).json({ success: false, message: 'Batch not found in Central Inventory' });
  }

  // Stock check
  if (!overrideFlag) {
    if (invItem.bone < nBone || invItem.boneless < nBoneless || invItem.mixed < nMixed) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient stock',
        available: { bone: invItem.bone, boneless: invItem.boneless, mixed: invItem.mixed },
        required:  { bone: nBone,       boneless: nBoneless,        mixed: nMixed       },
        canOverride: true,
      });
    }
  }

  // Fetch dynamic prices for this shop (shop-specific → global → fallback)
  const prices = await getPrices(shopId);

  // Deduct from central inventory
  invItem.bone     = Math.max(0, invItem.bone     - nBone);
  invItem.boneless = Math.max(0, invItem.boneless - nBoneless);
  invItem.mixed    = Math.max(0, invItem.mixed    - nMixed);
  invItem.totalWeight = invItem.bone + invItem.boneless + invItem.mixed;

  // Recalculate remaining inventory value using dynamic prices
  invItem.totalAmount =
    invItem.bone     * prices.bone     +
    invItem.boneless * prices.boneless +
    invItem.mixed    * prices.mixed;

  invItem.status = invItem.totalWeight > 0 ? 'Available' : 'Empty';
  await invItem.save();

  // Calculate supply total amount using dynamic prices
  const calculatedAmount =
    (nBone     * prices.bone)     +
    (nBoneless * prices.boneless) +
    (nMixed    * prices.mixed);
  const totalAmount = calculatedAmount + nExtra;

  // Create supply record
  const supply = await InventorySupply.create({
    shopId: shopId || null,
    externalRecipient: externalRecipient || { name: '', address: '' },
    batch,
    bone: nBone,
    boneless: nBoneless,
    mixed: nMixed,
    extra: nExtra,
    total,
    totalAmount,
    overrideFlag: !!overrideFlag,
    date,
  });

  // Auto-create ShopInventory entry if going to a registered shop
  if (shopId) {
    await ShopInventory.create({
      shopId,
      supplyId:    supply._id,
      batch,
      transport:   'Internal Supply',
      bone:        nBone,
      boneless:    nBoneless,
      mixed:       nMixed,
      skin:        0,
      meat:        0,
      rate:        0,
      totalWeight: total,
      totalAmount,
      date,
    });
  }

  res.status(201).json({ success: true, data: supply });
};

// @desc   Update supply record
// @route  PUT /api/supplies/:id
const updateSupply = async (req, res) => {
  const supply = await InventorySupply.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!supply) return res.status(404).json({ success: false, message: 'Supply record not found' });
  res.json({ success: true, data: supply });
};

// @desc   Delete supply record (and restore stock to central inventory)
// @route  DELETE /api/supplies/:id
const deleteSupply = async (req, res) => {
  const supply = await InventorySupply.findByIdAndDelete(req.params.id);
  if (!supply) return res.status(404).json({ success: false, message: 'Supply record not found' });

  if (supply.shopId) {
    await ShopInventory.findOneAndDelete({ supplyId: supply._id });
  }

  // Restore the stock to CentralInventory
  const invItem = await CentralInventory.findOne({ batchNo: supply.batch });
  if (invItem) {
    invItem.bone += (supply.bone || 0);
    invItem.boneless += (supply.boneless || 0);
    invItem.mixed += (supply.mixed || 0);
    
    invItem.totalWeight = invItem.bone + invItem.boneless + invItem.mixed;
    
    // Fetch dynamic prices to calculate new total amount
    const prices = await getPrices(supply.shopId);
    
    // Recalculate remaining inventory value using dynamic prices
    invItem.totalAmount =
      invItem.bone     * prices.bone     +
      invItem.boneless * prices.boneless +
      invItem.mixed    * prices.mixed;

    invItem.status = invItem.totalWeight > 0 ? 'Available' : 'Empty';
    await invItem.save();
  }

  res.json({ success: true, message: 'Supply restored to inventory' });
};

module.exports = { getSupplies, createSupply, updateSupply, deleteSupply };
