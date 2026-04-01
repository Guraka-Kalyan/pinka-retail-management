const express = require('express');
const { login, getMe } = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth');
const { validate, loginSchema } = require('../middleware/validate');

const router = express.Router();

router.post('/login', validate(loginSchema), login);
router.get('/me', protect, getMe);

module.exports = router;
