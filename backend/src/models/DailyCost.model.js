const mongoose = require('mongoose');

const dailyCostSchema = new mongoose.Schema({
  shopId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shop',
    required: true,
  },
  date: { type: String, required: true },
  labour: { type: Number, default: 0 },
  transport: { type: Number, default: 0 },
  ice: { type: Number, default: 0 },
  misc: { type: Number, default: 0 },
  otherCosts: [
    {
      name: { type: String, required: true },
      amount: { type: Number, required: true },
    },
  ],
  notes: { type: String, default: '' },
  total: { type: Number, default: 0 },
  // Soft delete
  deletedAt: { type: Date, default: null },
}, { timestamps: true });

dailyCostSchema.index({ shopId: 1, date: -1 });
dailyCostSchema.index({ deletedAt: 1 });

module.exports = mongoose.model('DailyCost', dailyCostSchema);
