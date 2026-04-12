const jwt = require('jsonwebtoken');
const User = require('../models/User.model');

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-passwordHash');

    if (!req.user) {
      return res.status(401).json({ success: false, message: 'User no longer exists.' });
    }

    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Not authorized. Invalid token.' });
  }
};

const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Forbidden. Insufficient permissions.' });
    }
    next();
  };
};

const verifyShopAccess = (req, res, next) => {
  // If user doesn't have specific limitations, let them pass
  if (!req.user || req.user.shopAccess !== 'specific') {
    return next();
  }

  const shopId = req.params.shopId;
  
  if (!shopId) {
    return next(); // if no shopId in params, nothing to check here
  }

  // Ensure assignedShops is an array of strings for comparison
  const assigned = (req.user.assignedShops || []).map(id => id.toString());
  
  if (!assigned.includes(shopId)) {
    return res.status(403).json({ success: false, message: 'Forbidden. You do not have access to this shop.' });
  }

  next();
};

module.exports = { protect, requireRole, verifyShopAccess };
