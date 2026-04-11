const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User.model');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

// @desc   Login user
// @route  POST /api/auth/login
const login = async (req, res) => {
  const { name, password } = req.body;
  if (!name || !password) {
    return res.status(400).json({ success: false, message: 'Name and password are required' });
  }
  const user = await User.findOne({ name });
  if (!user || !(await user.comparePassword(password))) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
  const token = generateToken(user._id);
  res.json({
    success: true,
    token,
    user: { id: user._id, name: user.name, username: user.username || user.name, role: user.role, assignedShop: user.assignedShop },
  });
};

// @desc   Get current user
// @route  GET /api/auth/me
const getMe = async (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user._id,
      name: req.user.name,
      username: req.user.username || req.user.name,
      role: req.user.role,
      assignedShop: req.user.assignedShop,
    },
  });
};

// @desc   Change password
// @route  PUT /api/auth/change-password
const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ success: false, message: 'Current and new passwords are required' });
  }
  const user = await User.findById(req.user._id);
  if (!(await user.comparePassword(currentPassword))) {
    return res.status(400).json({ success: false, message: 'Current password is incorrect' });
  }
  user.passwordHash = newPassword;
  await user.save();
  res.json({ success: true, message: 'Password updated successfully' });
};

// @desc   Register a new user (Admin only)
// @route  POST /api/auth/register
const register = async (req, res) => {
  const { name, username, password, role } = req.body;
  if (!name || !password) {
    return res.status(400).json({ success: false, message: 'Name and password are required' });
  }
  const exists = await User.findOne({ name });
  if (exists) {
    return res.status(400).json({ success: false, message: 'A user with that name already exists' });
  }
  const user = await User.create({
    name,
    username: username || name,
    role: role || 'Staff',
    passwordHash: password,
  });
  res.status(201).json({
    success: true,
    data: { id: user._id, name: user.name, username: user.username, role: user.role },
  });
};

// @desc   Get all users (Admin only)
// @route  GET /api/auth/users
const getUsers = async (req, res) => {
  const users = await User.find().select('-passwordHash').sort({ createdAt: -1 });
  res.json({ success: true, data: users });
};

// @desc   Delete a user (Admin only)
// @route  DELETE /api/auth/users/:id
const deleteUser = async (req, res) => {
  if (req.params.id === req.user._id.toString()) {
    return res.status(400).json({ success: false, message: 'You cannot delete your own account' });
  }
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  res.json({ success: true, message: 'User deleted successfully' });
};

module.exports = { login, getMe, changePassword, register, getUsers, deleteUser };
