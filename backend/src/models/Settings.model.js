const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  shopId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shop',
    default: null, // null = global default
  },
  fry: { type: Number, default: 280 },
  curry: { type: Number, default: 250 },
  bone: { type: Number, default: 200 },
  boneless: { type: Number, default: 400 },
  mixed: { type: Number, default: 200 },
}, { timestamps: true });

// One settings document per shop (or one global with shopId = null)
settingsSchema.index({ shopId: 1 }, { unique: true });

module.exports = mongoose.model('Settings', settingsSchema);
