/**
 * One-time cleanup script:
 *  1. Removes duplicate CentralInventory records per batchNo
 *     (keeps the one with the highest totalWeight / packedWeight)
 *  2. Backfills packedWeight / packedAmount on existing records that
 *     were created before those snapshot fields were added
 *
 * Run: node fix-duplicate-inventory.js
 */
require('dotenv').config();
const mongoose = require('mongoose');

const centralInventorySchema = new mongoose.Schema({
  batchId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Batch' },
  batchNo:      String,
  bone:         { qty: Number, pricePerKg: Number },
  boneless:     { qty: Number, pricePerKg: Number },
  mixed:        { qty: Number, pricePerKg: Number },
  totalWeight:  Number,
  totalAmount:  Number,
  packedWeight: { type: Number, default: 0 },
  packedAmount: { type: Number, default: 0 },
  status:       String,
  date:         String,
}, { timestamps: true });

const CentralInventory = mongoose.model('CentralInventory', centralInventorySchema);

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected to MongoDB');

  // ── Step 1: Group all records by batchNo ────────────────────────────────
  const all = await CentralInventory.find({}).lean();
  const grouped = {};
  all.forEach(item => {
    const key = item.batchNo || String(item._id);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(item);
  });

  let removedCount = 0;
  let backfilledCount = 0;

  for (const [batchNo, records] of Object.entries(grouped)) {
    if (records.length > 1) {
      // Sort: keep the one with the highest totalWeight (most complete record)
      records.sort((a, b) => (b.totalWeight || 0) - (a.totalWeight || 0));
      const keep = records[0];
      const toRemove = records.slice(1).map(r => r._id);

      await CentralInventory.deleteMany({ _id: { $in: toRemove } });
      console.log(`🗑  Removed ${toRemove.length} duplicate(s) for batchNo: ${batchNo} — kept _id: ${keep._id}`);
      removedCount += toRemove.length;
    }
  }

  // ── Step 2: Backfill packedWeight/packedAmount for records missing them ─
  const missing = await CentralInventory.find({
    $or: [
      { packedWeight: { $exists: false } },
      { packedWeight: 0, totalWeight: { $gt: 0 } },
    ]
  });

  for (const item of missing) {
    const pw = item.totalWeight || 0;
    const pa = (item.bone?.qty     || 0) * (item.bone?.pricePerKg     || 0)
             + (item.boneless?.qty || 0) * (item.boneless?.pricePerKg || 0)
             + (item.mixed?.qty    || 0) * (item.mixed?.pricePerKg    || 0)
             || item.totalAmount || 0;

    await CentralInventory.findByIdAndUpdate(item._id, {
      packedWeight: pw,
      packedAmount: pa,
    });
    console.log(`✏️  Backfilled packedWeight=${pw} packedAmount=${pa} for batchNo: ${item.batchNo}`);
    backfilledCount++;
  }

  console.log(`\n✅ Done. Removed: ${removedCount} duplicates | Backfilled: ${backfilledCount} records`);
  await mongoose.disconnect();
}

run().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
