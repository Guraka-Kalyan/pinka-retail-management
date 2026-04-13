const express = require('express');
const rateLimit = require('express-rate-limit');
const { login, getMe, changePassword, register, getUsers, deleteUser } = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth');
const { validate, loginSchema } = require('../middleware/validate');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many login attempts, please try again after 15 minutes' }
});

// Admin-only middleware
const adminOnly = (req, res, next) => {
  if (req.user?.role !== 'Admin') {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  next();
};

router.post('/login', loginLimiter, validate(loginSchema), login);
router.get('/me', protect, getMe);
router.put('/change-password', protect, changePassword);
router.post('/register', protect, adminOnly, register);
router.get('/users', protect, adminOnly, getUsers);
router.delete('/users/:id', protect, adminOnly, deleteUser);

module.exports = router;
