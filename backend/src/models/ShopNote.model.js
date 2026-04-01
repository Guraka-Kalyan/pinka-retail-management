const mongoose = require('mongoose');

const shopNoteSchema = new mongoose.Schema({
  shopId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shop',
    required: true,
  },
  text: {
    type: String,
    required: [true, 'Note text is required'],
    maxlength: [1000, 'Note cannot exceed 1000 characters'],
  },
}, { timestamps: true });

shopNoteSchema.index({ shopId: 1 });

module.exports = mongoose.model('ShopNote', shopNoteSchema);
