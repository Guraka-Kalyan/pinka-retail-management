const mongoose = require('mongoose');

const shopInventorySchema = new mongoose.Schema({
  shopId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shop',
    required: true,
  },
  supplyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InventorySupply',
    default: null,
  },
  batch: { type: String, required: true },
  transport: { type: String, default: 'Internal Supply' },
  bone: { type: Number, default: 0 },
  boneless: { type: Number, default: 0 },
  mixed: { type: Number, default: 0 },
  skin: { type: Number, default: 0 },
  meat: { type: Number, default: 0 },
  rate: { type: Number, default: 0 },
  totalWeight: { type: Number, default: 0 },
  totalAmount: { type: Number, default: 0 },
  date: { type: String, required: true },
}, { timestamps: true });

shopInventorySchema.index({ shopId: 1, date: -1 });

module.exports = mongoose.model('ShopInventory', shopInventorySchema);
