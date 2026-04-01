const mongoose = require('mongoose');

const inventorySupplySchema = new mongoose.Schema({
  shopId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shop',
    default: null,
  },
  externalRecipient: {
    name: { type: String, default: '' },
    address: { type: String, default: '' },
  },
  batch: { type: String, required: true },
  bone: { type: Number, default: 0 },
  boneless: { type: Number, default: 0 },
  mixed: { type: Number, default: 0 },
  extra: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  totalAmount: { type: Number, default: 0 },
  overrideFlag: { type: Boolean, default: false },
  date: { type: String, required: true },
}, { timestamps: true });

inventorySupplySchema.index({ shopId: 1, date: -1 });

module.exports = mongoose.model('InventorySupply', inventorySupplySchema);
