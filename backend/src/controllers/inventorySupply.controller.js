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
  const { shopId, externalRecipient, batch, bone, boneless, mixed, extra, overrideFlag, date, bonePrice, bonelessPrice, mixedPrice } = req.body;

  if (!batch || !date) {
    return res.status(400).json({ success: false, message: 'batch and date are required' });
  }

  const nBone = Number(bone) || 0;
  const nBoneless = Number(boneless) || 0;
  const nMixed = Number(mixed) || 0;
  const nExtra = Number(extra) || 0;
  const total = nBone + nBoneless + nMixed;

  if (total === 0) {
    return res.status(400).json({ success: false, message: 'Enter at least one quantity to supply' });
  }

  // Find central inventory for this batch
  const invItem = await CentralInventory.findOne({ batchNo: batch });
  if (!invItem) {
    return res.status(404).json({ success: false, message: 'Batch not found in Central Inventory' });
  }

  const totalSupply = nBone + nBoneless + nMixed;

  // Stock check
  if (!overrideFlag) {
    if (totalSupply > (invItem.mixed?.qty || 0)) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient stock in batch',
        available: { mixed: invItem.mixed?.qty || 0 },
        required: { total: totalSupply },
        canOverride: true,
      });
    }
  }

  // Prices directly from CentralInventory
  const prices = {
    bone: invItem.bone?.pricePerKg || 0,
    boneless: invItem.boneless?.pricePerKg || 0,
    mixed: invItem.mixed?.pricePerKg || 0,
  };

  // Deduct from central inventory's single tracking pool (mixed)
  if (invItem.mixed) {
    invItem.mixed.qty = Math.max(0, (invItem.mixed.qty || 0) - totalSupply);
  }
  invItem.totalWeight = (invItem.bone?.qty || 0) + (invItem.boneless?.qty || 0) + (invItem.mixed?.qty || 0);

  // Recalculate remaining inventory value using central prices
  invItem.totalAmount =
    (invItem.bone?.qty || 0) * prices.bone +
    (invItem.boneless?.qty || 0) * prices.boneless +
    (invItem.mixed?.qty || 0) * prices.mixed;

  invItem.status = invItem.totalWeight > 0 ? 'Available' : 'Empty';
  await invItem.save();

  // Re-calculate the new total using updated prices from frontend
  const calculatedAmount =
    (nBone * (Number(bonePrice) || 0)) +
    (nBoneless * (Number(bonelessPrice) || 0)) +
    (nMixed * (Number(mixedPrice) || 0));
  const totalAmount = calculatedAmount + nExtra;

  // Create supply record
  const supply = await InventorySupply.create({
    shopId: shopId || null,
    externalRecipient: externalRecipient || { name: '', address: '' },
    batch,
    bone: nBone,
    boneless: nBoneless,
    mixed: nMixed,
    bonePrice: Number(bonePrice) || 0,
    bonelessPrice: Number(bonelessPrice) || 0,
    mixedPrice: Number(mixedPrice) || 0,
    extra: nExtra,
    total: totalAmount,
    totalAmount,
    overrideFlag: !!overrideFlag,
    date,
  });

  // Auto-create ShopInventory entry if going to a registered shop
  if (shopId) {
    await ShopInventory.create({
      shopId,
      supplyId: supply._id,
      batch,
      transport: 'Internal Supply',
      bone: nBone,
      boneless: nBoneless,
      mixed: nMixed,
      skin: 0,
      meat: 0,
      rate: 0,
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
  const { shopId, externalRecipient, batch, bone, boneless, mixed, extra, date, bonePrice, bonelessPrice, mixedPrice } = req.body;

  const oldSupply = await InventorySupply.findById(req.params.id);
  if (!oldSupply) return res.status(404).json({ success: false, message: 'Supply record not found' });

  const nBone = Number(req.body.bone) || 0;
  const nBoneless = Number(req.body.boneless) || 0;
  const nMixed = Number(req.body.mixed) || 0;

  const deltaBone = nBone - (oldSupply.bone || 0);
  const deltaBoneless = nBoneless - (oldSupply.boneless || 0);
  const deltaMixed = nMixed - (oldSupply.mixed || 0);
  const deltaTotal = deltaBone + deltaBoneless + deltaMixed;

  const invItem = await CentralInventory.findOne({ batchNo: oldSupply.batch });
  if (invItem && !req.body.overrideFlag) {
    if ((invItem.mixed?.qty || 0) - deltaTotal < 0) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient stock in Inventory In to cover this update.',
        available: { mixed: invItem.mixed?.qty || 0 },
        requiredDelta: { total: deltaTotal },
        canOverride: true
      });
    }
  }

  const supply = await InventorySupply.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  if (supply.shopId) {
    const shopInv = await ShopInventory.findOne({ supplyId: supply._id });
    if (shopInv) {
      shopInv.bone += deltaBone;
      shopInv.boneless += deltaBoneless;
      shopInv.mixed += deltaMixed;
      shopInv.totalWeight = shopInv.bone + shopInv.boneless + shopInv.mixed;
      if (req.body.totalAmount !== undefined) {
        shopInv.totalAmount = req.body.totalAmount;
      }
      await shopInv.save();
    }
  }

  if (invItem) {
    if (invItem.mixed) {
      invItem.mixed.qty = Math.max(0, (invItem.mixed.qty || 0) - deltaTotal);
    }
    invItem.totalWeight = (invItem.bone?.qty || 0) + (invItem.boneless?.qty || 0) + (invItem.mixed?.qty || 0);

    const prices = {
      bone: invItem.bone?.pricePerKg || 0,
      boneless: invItem.boneless?.pricePerKg || 0,
      mixed: invItem.mixed?.pricePerKg || 0,
    };
    
    invItem.totalAmount =
      (invItem.bone?.qty || 0) * prices.bone +
      (invItem.boneless?.qty || 0) * prices.boneless +
      (invItem.mixed?.qty || 0) * prices.mixed;

    invItem.status = invItem.totalWeight > 0 ? 'Available' : 'Empty';
    await invItem.save();
  }

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

  // Restore the stock to CentralInventory (single pool)
  const invItem = await CentralInventory.findOne({ batchNo: supply.batch });
  if (invItem) {
    const supplyTotal = (supply.bone || 0) + (supply.boneless || 0) + (supply.mixed || 0);
    if (invItem.mixed) invItem.mixed.qty += supplyTotal;

    invItem.totalWeight = (invItem.bone?.qty || 0) + (invItem.boneless?.qty || 0) + (invItem.mixed?.qty || 0);

    const prices = {
      bone: invItem.bone?.pricePerKg || 0,
      boneless: invItem.boneless?.pricePerKg || 0,
      mixed: invItem.mixed?.pricePerKg || 0,
    };

    // Recalculate remaining inventory value using central prices
    invItem.totalAmount =
      (invItem.bone?.qty || 0) * prices.bone +
      (invItem.boneless?.qty || 0) * prices.boneless +
      (invItem.mixed?.qty || 0) * prices.mixed;

    invItem.status = invItem.totalWeight > 0 ? 'Available' : 'Empty';
    await invItem.save();
  }

  res.json({ success: true, message: 'Supply restored to inventory' });
};

module.exports = { getSupplies, createSupply, updateSupply, deleteSupply };
