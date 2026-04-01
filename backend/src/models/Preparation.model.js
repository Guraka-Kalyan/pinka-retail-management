const mongoose = require('mongoose');

const preparationSchema = new mongoose.Schema({
  shopId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shop',
    required: true,
  },
  date: { type: String, required: true },
  refId: { type: String, default: '' },
  boneFry: { type: Number, default: 0 },
  bonelessFry: { type: Number, default: 0 },
  boneCurry: { type: Number, default: 0 },
  bonelessCurry: { type: Number, default: 0 },
  fryOutput: { type: Number, default: 0 },
  curryOutput: { type: Number, default: 0 },
  boneUsed: { type: Number, default: 0 },
  bonelessUsed: { type: Number, default: 0 },
}, { timestamps: true });

preparationSchema.index({ shopId: 1, date: -1 });

module.exports = mongoose.model('Preparation', preparationSchema);
