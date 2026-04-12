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
  const currentBatch = await Batch.findById(req.params.id);
  if (!currentBatch) return res.status(404).json({ success: false, message: 'Batch not found' });

  let updateData = { ...req.body };

  if (updateData.head !== undefined || updateData.ribs !== undefined || updateData.ham !== undefined || updateData.offals !== undefined) {
    const head = Number(updateData.head !== undefined ? updateData.head : currentBatch.head) || 0;
    const ribs = Number(updateData.ribs !== undefined ? updateData.ribs : currentBatch.ribs) || 0;
    const ham = Number(updateData.ham !== undefined ? updateData.ham : currentBatch.ham) || 0;
    const offals = Number(updateData.offals !== undefined ? updateData.offals : currentBatch.offals) || 0;

    const animalWeight = Number(updateData.animalWeight !== undefined ? updateData.animalWeight : currentBatch.animalWeight) || 0;

    const totalASW = head + ribs + ham + offals;
    const slaughterLoss = animalWeight > 0 ? (animalWeight - totalASW) : 0;
    const carcassWaste = head + offals;
    const totalWastage = slaughterLoss + carcassWaste;
    const wastagePercent = animalWeight > 0 ? Number(((totalWastage / animalWeight) * 100).toFixed(2)) : 0;
    const usableMeat = totalASW - carcassWaste;

    updateData.totalWeight = totalASW;
    updateData.usableMeat = usableMeat;
    updateData.wastagePercent = wastagePercent;
  }

  const batch = await Batch.findByIdAndUpdate(req.params.id, updateData, {
    new: true,
    runValidators: true,
  });
  
  if (batch && batch.pkgItems) {
    const pkgItems = batch.pkgItems;
    await CentralInventory.findOneAndUpdate(
      { batchId: req.params.id },
      {
        'bone.qty': pkgItems.bone?.qty || 0,
        'boneless.qty': pkgItems.boneless?.qty || 0,
        'mixed.qty': pkgItems.mixed?.qty || 0,
        totalWeight: (pkgItems.bone?.qty || 0) + 
                     (pkgItems.boneless?.qty || 0) + 
                     (pkgItems.mixed?.qty || 0),
      }
    );
  }

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

  const boneQty      = pkgItems.bone?.qty      || 0;
  const bonelessQty  = pkgItems.boneless?.qty   || 0;
  const mixedQty     = pkgItems.mixed?.qty      || 0;
  const totalWeight  = boneQty + bonelessQty + mixedQty;
  const totalAmount  = boneQty    * (pkgItems.bone?.pricePerKg      || 0)
                     + bonelessQty * (pkgItems.boneless?.pricePerKg  || 0)
                     + mixedQty    * (pkgItems.mixed?.pricePerKg     || 0);

  // Update batch status and pkgItems
  batch.pkgItems = pkgItems;
  batch.status = 'Packed';
  await batch.save();

  // Upsert CentralInventory record
  // $set  → mutable stock fields (change whenever packaging is re-saved)
  // $setOnInsert → snapshot fields written ONLY on first insert, never overwritten
  await CentralInventory.findOneAndUpdate(
    { batchId: batch._id },
    {
      $set: {
        batchNo:               batch.batchNo,
        date:                  batch.date,
        'bone.qty':            boneQty,
        'bone.pricePerKg':     pkgItems.bone?.pricePerKg      || 0,
        'boneless.qty':        bonelessQty,
        'boneless.pricePerKg': pkgItems.boneless?.pricePerKg  || 0,
        'mixed.qty':           mixedQty,
        'mixed.pricePerKg':    pkgItems.mixed?.pricePerKg     || 0,
        totalWeight,
        totalAmount,
        status: totalWeight > 0 ? 'Available' : 'Empty',
      },
      $setOnInsert: {
        // Snapshot — set ONCE at first pack, never changed again
        packedWeight: totalWeight,
        packedAmount: totalAmount,
      },
    },
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
