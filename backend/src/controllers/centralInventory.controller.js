const CentralInventory = require('../models/CentralInventory.model');

// @desc   Get all central inventory
// @route  GET /api/central-inventory
const getCentralInventory = async (req, res) => {
  const inventory = await CentralInventory.find().sort({ createdAt: -1 });
  res.json({ success: true, data: inventory });
};

// @desc   Create central inventory manually
// @route  POST /api/central-inventory
const createCentralInventory = async (req, res) => {
  const { batchNo, bone, boneless, mixed, date } = req.body;
  if (!batchNo) {
    return res.status(400).json({ success: false, message: 'batchNo is required' });
  }

  const nBone = Number(bone) || 0;
  const nBoneless = Number(boneless) || 0;
  const nMixed = Number(mixed) || 0;
  const totalWeight = nBone + nBoneless + nMixed;

  const item = await CentralInventory.create({
    batchNo,
    bone: nBone,
    boneless: nBoneless,
    mixed: nMixed,
    totalWeight,
    status: totalWeight > 0 ? 'Available' : 'Empty',
    createdAt: date ? new Date(date) : new Date()
  });

  res.status(201).json({ success: true, data: item });
};

// @desc   Get single item
// @route  GET /api/central-inventory/:id
const getCentralInventoryItem = async (req, res) => {
  const item = await CentralInventory.findById(req.params.id);
  if (!item) return res.status(404).json({ success: false, message: 'Inventory item not found' });
  res.json({ success: true, data: item });
};

// @desc   Update central inventory (e.g. manual stock correction)
const updateCentralInventory = async (req, res) => {
  const { bone, boneless, mixed } = req.body;
  
  let totalWeight = 0;
  let totalAmount = 0;
  
  if (bone) {
    totalWeight += Number(bone.qty) || 0;
    totalAmount += (Number(bone.qty) || 0) * (Number(bone.pricePerKg) || 0);
  }
  if (boneless) {
    totalWeight += Number(boneless.qty) || 0;
    totalAmount += (Number(boneless.qty) || 0) * (Number(boneless.pricePerKg) || 0);
  }
  if (mixed) {
    totalWeight += Number(mixed.qty) || 0;
    totalAmount += (Number(mixed.qty) || 0) * (Number(mixed.pricePerKg) || 0);
  }

  const updatePayload = {
    ...req.body,
    totalWeight,
    totalAmount,
    status: totalWeight > 0 ? 'Available' : 'Empty',
  };

  const item = await CentralInventory.findByIdAndUpdate(req.params.id, updatePayload, {
    new: true,
    runValidators: true,
  });
  if (!item) return res.status(404).json({ success: false, message: 'Inventory item not found' });
  res.json({ success: true, data: item });
};

// @desc   Delete central inventory item
// @route  DELETE /api/central-inventory/:id
const deleteCentralInventory = async (req, res) => {
  const item = await CentralInventory.findByIdAndDelete(req.params.id);
  if (!item) return res.status(404).json({ success: false, message: 'Inventory item not found' });
  res.json({ success: true, message: 'Inventory item deleted' });
};

module.exports = { getCentralInventory, createCentralInventory, getCentralInventoryItem, updateCentralInventory, deleteCentralInventory };
