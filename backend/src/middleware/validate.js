const Joi = require('joi');

// Reusable middleware factory
const validate = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body, { abortEarly: false });
  if (error) {
    const messages = error.details.map((d) => d.message.replace(/['"]/g, '')).join(', ');
    return res.status(400).json({ success: false, message: messages });
  }
  next();
};

// --- Schemas ---

const loginSchema = Joi.object({
  name:     Joi.string().min(1).max(100).required().label('Name'),
  password: Joi.string().min(1).required().label('Password'),
});

const createShopSchema = Joi.object({
  displayId:   Joi.string().max(20).allow('').optional(),
  name:        Joi.string().min(1).max(100).required().label('Shop name'),
  managerName: Joi.string().max(100).allow('').optional(),
  phone:       Joi.string().max(20).allow('').optional(),
  location:    Joi.string().max(200).allow('').optional(),
});

const createSaleSchema = Joi.object({
  date:          Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required().label('Date'),
  boneSold:      Joi.number().min(0).default(0),
  bonelessSold:  Joi.number().min(0).default(0),
  frySold:       Joi.number().min(0).default(0),
  currySold:     Joi.number().min(0).default(0),
  mixedSold:     Joi.number().min(0).default(0),
  boneUsed:      Joi.number().min(0).default(0),
  bonelessUsed:  Joi.number().min(0).default(0),
  fry:           Joi.number().min(0).default(0),
  curry:         Joi.number().min(0).default(0),
  cash:          Joi.number().min(0).default(0),
  phonePe:       Joi.number().min(0).default(0),
  total:         Joi.number().min(0).default(0),
  discountGiven: Joi.number().min(0).default(0),
});

module.exports = { validate, loginSchema, createShopSchema, createSaleSchema };
