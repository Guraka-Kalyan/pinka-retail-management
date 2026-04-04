const mongoose = require('mongoose');

const centralInventorySchema = new mongoose.Schema({
  batchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Batch',
    required: true,
  },
  batchNo: { type: String, required: true },
  bone: { type: Number, default: 0 },
  boneless: { type: Number, default: 0 },
  mixed: { type: Number, default: 0 },
  totalWeight: { type: Number, default: 0 },
  totalAmount: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['Available', 'Empty', 'Partial'],
    default: 'Available',
  },
  date: { type: String, required: true },
}, { timestamps: true });

centralInventorySchema.index({ status: 1 });

module.exports = mongoose.model('CentralInventory', centralInventorySchema);
