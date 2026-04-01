const mongoose = require('mongoose');

const saleSchema = new mongoose.Schema({
  shopId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shop',
    required: true,
  },
  date: { type: String, required: true },
  billId: { type: String, required: true },
  boneSold: { type: Number, default: 0 },
  bonelessSold: { type: Number, default: 0 },
  frySold: { type: Number, default: 0 },
  currySold: { type: Number, default: 0 },
  mixedSold: { type: Number, default: 0 },
  boneUsed: { type: Number, default: 0 },
  bonelessUsed: { type: Number, default: 0 },
  fry: { type: Number, default: 0 },
  curry: { type: Number, default: 0 },
  cash: { type: Number, default: 0 },
  phonePe: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  discountGiven: { type: Number, default: 0 },
  // Soft delete
  deletedAt: { type: Date, default: null },
}, { timestamps: true });

saleSchema.index({ shopId: 1, date: -1 });
saleSchema.index({ deletedAt: 1 });

module.exports = mongoose.model('Sale', saleSchema);
