const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    unique: true,
  },
  username: {
    type: String,
    trim: true,
    default: '',
  },
  role: {
    type: String,
    enum: ['Admin', 'Staff', 'shopstaff'],
    default: 'Staff',
  },
  passwordHash: {
    type: String,
    required: [true, 'Password is required'],
  },
  assignedShop: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shop',
  }
}, { timestamps: true });

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash')) return next();
  this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
  next();
});

// Compare passwords
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

module.exports = mongoose.model('User', userSchema);
