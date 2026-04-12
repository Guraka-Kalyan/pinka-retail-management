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
  // 'central' = dispatched from farm/central inventory; 'external' = direct shop purchase from vendor
  type: {
    type: String,
    enum: ['central', 'external'],
    default: 'central',
  },
  batch: { type: String, required: true },
  transport: { type: String, default: 'Internal Supply' },
  vendorName: { type: String, default: '' },
  notes: { type: String, default: '' },
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
shopInventorySchema.index({ shopId: 1, type: 1, date: -1 });

module.exports = mongoose.model('ShopInventory', shopInventorySchema);
