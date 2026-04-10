const express = require('express');
const { login, getMe, changePassword, register, getUsers, deleteUser } = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth');
const { validate, loginSchema } = require('../middleware/validate');

const router = express.Router();

// Admin-only middleware
const adminOnly = (req, res, next) => {
  if (req.user?.role !== 'Admin') {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  next();
};

router.post('/login', validate(loginSchema), login);
router.get('/me', protect, getMe);
router.put('/change-password', protect, changePassword);
router.post('/register', protect, adminOnly, register);
router.get('/users', protect, adminOnly, getUsers);
router.delete('/users/:id', protect, adminOnly, deleteUser);

module.exports = router;
