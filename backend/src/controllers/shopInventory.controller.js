const ShopInventory = require('../models/ShopInventory.model');

// @desc   Get shop inventory
// @route  GET /api/shops/:shopId/inventory-in
const getShopInventory = async (req, res) => {
  const records = await ShopInventory.find({ shopId: req.params.shopId }).sort({ date: -1 });
  res.json({ success: true, data: records });
};

// @desc   Add manual shop inventory entry (Central or External)
// @route  POST /api/shops/:shopId/inventory-in
const createShopInventory = async (req, res) => {
  const { type, vendorName, notes, date, transport, bone, boneless, mixed, skin, meat, rate, totalWeight, totalAmount } = req.body;
  let { batch } = req.body;

  if (!date) {
    return res.status(400).json({ success: false, message: 'date is required' });
  }

  // Auto-generate batch for external requests if not provided
  if (type === 'external' && !batch) {
    const timestamp = new Date().getTime().toString().slice(-4);
    batch = `EXT-BATCH-${timestamp}`;
  } else if (!batch) {
    return res.status(400).json({ success: false, message: 'batch is required for central inventory' });
  }

  const record = await ShopInventory.create({
    shopId: req.params.shopId,
    type: type || 'central',
    batch,
    date,
    transport: transport || '',
    vendorName: vendorName || '',
    notes: notes || '',
    bone: Number(bone) || 0,
    boneless: Number(boneless) || 0,
    mixed: Number(mixed) || 0,
    skin: Number(skin) || 0,
    meat: Number(meat) || 0,
    rate: Number(rate) || 0,
    totalWeight: Number(totalWeight) || 0,
    totalAmount: Number(totalAmount) || 0,
  });

  res.status(201).json({ success: true, data: record });
};

// @desc   Update shop inventory entry
// @route  PUT /api/shops/:shopId/inventory-in/:id
const updateShopInventory = async (req, res) => {
  const record = await ShopInventory.findOneAndUpdate(
    { _id: req.params.id, shopId: req.params.shopId },
    req.body,
    { new: true, runValidators: true }
  );
  if (!record) return res.status(404).json({ success: false, message: 'Record not found' });
  res.json({ success: true, data: record });
};

// @desc   Delete shop inventory entry
// @route  DELETE /api/shops/:shopId/inventory-in/:id
const deleteShopInventory = async (req, res) => {
  const record = await ShopInventory.findOne({ _id: req.params.id, shopId: req.params.shopId });
  if (!record) return res.status(404).json({ success: false, message: 'Record not found' });

  // If internal supply, restore to Central Inventory and cleanly delete the original Supply record
  if ((record.transport === 'Internal Supply' || record.supplyId) && record.supplyId) {
    const InventorySupply = require('../models/InventorySupply.model');
    const CentralInventory = require('../models/CentralInventory.model');

    const supply = await InventorySupply.findByIdAndDelete(record.supplyId);
    if (supply) {
      const invItem = await CentralInventory.findOne({ batchNo: supply.batch });
      if (invItem && invItem.mixed) {
        const supplyTotal = (supply.bone || 0) + (supply.boneless || 0) + (supply.mixed || 0);
        invItem.mixed.qty += supplyTotal;
        invItem.totalWeight = (invItem.bone?.qty || 0) + (invItem.boneless?.qty || 0) + (invItem.mixed?.qty || 0);
        invItem.status = invItem.totalWeight > 0 ? 'Available' : 'Empty';
        await invItem.save();
      }
    }
  }

  // Delete the shop inventory record
  await ShopInventory.findByIdAndDelete(record._id);

  res.json({ success: true, message: 'Record deleted', source: record.transport === 'Internal Supply' ? 'internal' : 'external' });
};

module.exports = { getShopInventory, createShopInventory, updateShopInventory, deleteShopInventory };
