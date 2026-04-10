const mongoose = require('mongoose');

const counterCashSchema = new mongoose.Schema({
  shopId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shop',
    required: true,
  },
  date: { type: String, required: true },
  openingCash: { type: Number, required: true, default: 0 },
  finalCash: { type: Number, default: 0 },
}, { timestamps: true });

// One record per shop per day
counterCashSchema.index({ shopId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('CounterCash', counterCashSchema);
