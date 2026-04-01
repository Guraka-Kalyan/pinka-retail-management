const mongoose = require('mongoose');

const batchSchema = new mongoose.Schema({
  batchNo: {
    type: String,
    required: [true, 'Batch number is required'],
    unique: true,
    trim: true,
  },
  animalId: {
    type: String,
    required: [true, 'Animal ID is required'],
    trim: true,
  },
  animalWeight: { type: Number, default: 0 },
  rate: { type: Number, default: 0 },
  cost: { type: Number, default: 0 },
  farmLocation: { type: String, trim: true, default: '' },
  date: { type: String, required: true },

  // After slaughter
  head: { type: Number, default: 0 },
  ribs: { type: Number, default: 0 },
  ham: { type: Number, default: 0 },
  offals: { type: Number, default: 0 },
  totalWeight: { type: mongoose.Schema.Types.Mixed, default: '-' },
  usableMeat: { type: mongoose.Schema.Types.Mixed, default: '-' },
  wastagePercent: { type: mongoose.Schema.Types.Mixed, default: '-' },

  status: {
    type: String,
    enum: ['Unslaughtered', 'Slaughtered', 'Packed'],
    default: 'Unslaughtered',
  },

  // Packaging
  pkgItems: {
    bone: { type: Number, default: 0 },
    boneless: { type: Number, default: 0 },
    mixed: { type: Number, default: 0 },
    skin: { type: Number, default: 0 },
    meat: { type: Number, default: 0 },
  },
}, { timestamps: true });

batchSchema.index({ date: -1 });
batchSchema.index({ status: 1 });

module.exports = mongoose.model('Batch', batchSchema);
