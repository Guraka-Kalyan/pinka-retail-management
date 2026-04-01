const mongoose = require('mongoose');

const shopSchema = new mongoose.Schema({
  displayId: {
    type: String,
    trim: true,
    default: '',
  },
  name: {
    type: String,
    required: [true, 'Shop name is required'],
    trim: true,
  },
  managerName: {
    type: String,
    trim: true,
    default: '',
  },
  phone: {
    type: String,
    trim: true,
    default: '',
  },
  location: {
    type: String,
    trim: true,
    default: '',
  },
}, { timestamps: true });

module.exports = mongoose.model('Shop', shopSchema);
