require('dotenv').config();
require('express-async-errors');

const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');
const connectDB     = require('./src/config/db');
const errorHandler  = require('./src/middleware/errorHandler');

// Route imports
const authRoutes           = require('./src/routes/auth.routes');
const shopRoutes           = require('./src/routes/shop.routes');
const shopNoteRoutes       = require('./src/routes/shopNote.routes');
const batchRoutes          = require('./src/routes/batch.routes');
const centralInventoryRoutes = require('./src/routes/centralInventory.routes');
const inventorySupplyRoutes  = require('./src/routes/inventorySupply.routes');
const shopInventoryRoutes    = require('./src/routes/shopInventory.routes');
const preparationRoutes      = require('./src/routes/preparation.routes');
const saleRoutes             = require('./src/routes/sale.routes');
const dailyCostRoutes        = require('./src/routes/dailyCost.routes');
const counterCashRoutes      = require('./src/routes/counterCash.routes');
const settingsRoutes         = require('./src/routes/settings.routes');
const reportRoutes           = require('./src/routes/report.routes');
const dashboardRoutes        = require('./src/routes/dashboard.routes');

const app = express();
app.set('trust proxy', 1); // Required for express-rate-limit behind Nginx proxy

// Connect to MongoDB
connectDB();

// ─── Security Middleware ──────────────────────────────────────────────────────
app.use(helmet());

// ─── Request Logging ──────────────────────────────────────────────────────────
// 'dev' format in development, 'combined' (Apache-style) in production
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ─── CORS ─────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true
}));

// ─── Body Parser ──────────────────────────────────────────────────────────────
app.use(express.json());

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth',              authRoutes);
app.use('/api/shops',             shopRoutes);
app.use('/api/shops',             shopNoteRoutes);
app.use('/api/shops',             shopInventoryRoutes);
app.use('/api/shops',             preparationRoutes);
app.use('/api/shops',             saleRoutes);
app.use('/api/shops',             dailyCostRoutes);
app.use('/api/shops',             counterCashRoutes);
app.use('/api/batches',           batchRoutes);
app.use('/api/central-inventory', centralInventoryRoutes);
app.use('/api/supplies',          inventorySupplyRoutes);
app.use('/api/settings',          settingsRoutes);
app.use('/api/reports',           reportRoutes);
app.use('/api/dashboard',         dashboardRoutes);

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📦 Environment: ${process.env.NODE_ENV}`);
  console.log(`🌐 CORS allowed origin: ${process.env.CORS_ORIGIN || '*'}`);
});
