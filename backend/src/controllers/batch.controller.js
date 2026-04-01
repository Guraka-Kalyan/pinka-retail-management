const Batch = require('../models/Batch.model');
const CentralInventory = require('../models/CentralInventory.model');

// @desc   Get all batches
// @route  GET /api/batches
const getBatches = async (req, res) => {
  const batches = await Batch.find().sort({ createdAt: -1 });
  res.json({ success: true, data: batches });
};

// @desc   Get single batch
// @route  GET /api/batches/:id
const getBatch = async (req, res) => {
  const batch = await Batch.findById(req.params.id);
  if (!batch) return res.status(404).json({ success: false, message: 'Batch not found' });
  res.json({ success: true, data: batch });
};

// @desc   Create batch (Before Slaughter)
// @route  POST /api/batches
const createBatch = async (req, res) => {
  const { animalId, animalWeight, rate, cost, farmLocation, date } = req.body;
  if (!animalId || !date) {
    return res.status(400).json({ success: false, message: 'animalId and date are required' });
  }

  // Auto-generate batch number
  const count = await Batch.countDocuments();
  const batchNo = `BAT-${String(count + 1).padStart(3, '0')}`;

  const batch = await Batch.create({
    batchNo,
    animalId,
    animalWeight: Number(animalWeight) || 0,
    rate: Number(rate) || 0,
    cost: Number(cost) || 0,
    farmLocation: farmLocation || '',
    date,
    status: 'Unslaughtered',
  });

  res.status(201).json({ success: true, data: batch });
};

// @desc   Update batch (After slaughter / Edit)
// @route  PUT /api/batches/:id
const updateBatch = async (req, res) => {
  const batch = await Batch.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!batch) return res.status(404).json({ success: false, message: 'Batch not found' });
  res.json({ success: true, data: batch });
};

// @desc   Package batch and move to Central Inventory
// @route  PUT /api/batches/:id/packaging
const packageBatch = async (req, res) => {
  const { pkgItems } = req.body;
  if (!pkgItems) {
    return res.status(400).json({ success: false, message: 'pkgItems is required' });
  }

  const batch = await Batch.findById(req.params.id);
  if (!batch) return res.status(404).json({ success: false, message: 'Batch not found' });

  const defaultPrices = { bone: 350, boneless: 400, mixed: 380, skin: 50, meat: 450 };
  const totalWeight = (pkgItems.bone || 0) + (pkgItems.boneless || 0) + (pkgItems.mixed || 0) + (pkgItems.skin || 0) + (pkgItems.meat || 0);
  const totalAmount =
    (pkgItems.bone || 0) * defaultPrices.bone +
    (pkgItems.boneless || 0) * defaultPrices.boneless +
    (pkgItems.mixed || 0) * defaultPrices.mixed +
    (pkgItems.skin || 0) * defaultPrices.skin +
    (pkgItems.meat || 0) * defaultPrices.meat;

  // Update batch status and pkgItems
  batch.pkgItems = pkgItems;
  batch.status = 'Packed';
  await batch.save();

  // Upsert CentralInventory record
  const invData = {
    batchId: batch._id,
    batchNo: batch.batchNo,
    date: batch.date,
    bone: pkgItems.bone || 0,
    boneless: pkgItems.boneless || 0,
    mixed: pkgItems.mixed || 0,
    skin: pkgItems.skin || 0,
    meat: pkgItems.meat || 0,
    totalWeight,
    totalAmount,
    status: 'Available',
  };

  await CentralInventory.findOneAndUpdate(
    { batchId: batch._id },
    invData,
    { upsert: true, new: true }
  );

  res.json({ success: true, data: batch, message: 'Batch packaged and moved to Central Inventory' });
};

// @desc   Delete batch
// @route  DELETE /api/batches/:id
const deleteBatch = async (req, res) => {
  const batch = await Batch.findById(req.params.id);
  if (!batch) return res.status(404).json({ success: false, message: 'Batch not found' });

  // Remove from central inventory if packed
  if (batch.status === 'Packed') {
    await CentralInventory.findOneAndDelete({ batchId: batch._id });
  }

  await batch.deleteOne();
  res.json({ success: true, message: 'Batch deleted' });
};

module.exports = { getBatches, getBatch, createBatch, updateBatch, packageBatch, deleteBatch };
