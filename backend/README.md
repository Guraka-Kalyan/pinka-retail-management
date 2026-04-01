# Pinaka Backend API

Production-ready Express.js + MongoDB backend for the Pinaka Retail Meat Shop Management System.

## Quick Start

### 1. Install dependencies
```bash
cd backend
npm install
```

### 2. Configure environment
Edit `.env`:
```
PORT=5000
MONGO_URI=mongodb://localhost:27017/pinaka
JWT_SECRET=your_secret_key_here
JWT_EXPIRES_IN=7d
NODE_ENV=development
```

For MongoDB Atlas (cloud):
```
MONGO_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/pinaka
```

### 3. Seed the database (create admin user)
```bash
npm run seed
```
Creates: **admin / pinaka123**

### 4. Start the server
```bash
npm run dev      # Development (with nodemon auto-reload)
npm start        # Production
```

Server runs at: **http://localhost:5000**

---

## Project Structure

```
backend/
  src/
    config/
      db.js                     ← MongoDB connection
    controllers/
      auth.controller.js
      shop.controller.js
      shopNote.controller.js
      batch.controller.js
      centralInventory.controller.js
      inventorySupply.controller.js
      shopInventory.controller.js
      preparation.controller.js
      sale.controller.js         ← Includes PDF receipt
      dailyCost.controller.js
      counterCash.controller.js
      settings.controller.js
      report.controller.js
      dashboard.controller.js
    models/
      User.model.js
      Shop.model.js
      Batch.model.js
      CentralInventory.model.js
      InventorySupply.model.js
      ShopInventory.model.js
      Preparation.model.js
      Sale.model.js              ← Soft delete
      DailyCost.model.js         ← Soft delete
      CounterCash.model.js
      ShopNote.model.js
      Settings.model.js
    routes/
      auth.routes.js
      shop.routes.js
      shopNote.routes.js
      batch.routes.js
      centralInventory.routes.js
      inventorySupply.routes.js
      shopInventory.routes.js
      preparation.routes.js
      sale.routes.js
      dailyCost.routes.js
      counterCash.routes.js
      settings.routes.js
      report.routes.js
      dashboard.routes.js
    middleware/
      auth.js                    ← JWT protect middleware
      errorHandler.js            ← Global error handler
    utils/
      seed.js                    ← Admin user seeder
  .env
  .env.example
  .gitignore
  package.json
  server.js
```

---

## API Reference

All routes are prefixed with `/api`. All routes except `/api/auth/login` and `/api/health` require:
```
Authorization: Bearer <token>
```

### Auth
| Method | Route | Body |
|--------|-------|------|
| POST | `/api/auth/login` | `{ name, password }` |
| GET | `/api/auth/me` | — |

### Shops
| Method | Route |
|--------|-------|
| GET | `/api/shops` |
| POST | `/api/shops` |
| PUT | `/api/shops/:id` |
| DELETE | `/api/shops/:id` |

### Shop Notes
| Method | Route |
|--------|-------|
| GET | `/api/shops/:shopId/notes` |
| POST | `/api/shops/:shopId/notes` |
| GET | `/api/shops/notes/all` |
| PUT | `/api/shops/notes/:noteId` |
| DELETE | `/api/shops/notes/:noteId` |

### Batches (Dressing)
| Method | Route |
|--------|-------|
| GET | `/api/batches` |
| POST | `/api/batches` |
| PUT | `/api/batches/:id` |
| PUT | `/api/batches/:id/packaging` ← moves to CentralInventory |
| DELETE | `/api/batches/:id` |

### Central Inventory
| Method | Route |
|--------|-------|
| GET | `/api/central-inventory` |
| PUT | `/api/central-inventory/:id` |
| DELETE | `/api/central-inventory/:id` |

### Supply
| Method | Route |
|--------|-------|
| GET | `/api/supplies` |
| POST | `/api/supplies` ← deducts stock + creates ShopInventory |
| PUT | `/api/supplies/:id` |
| DELETE | `/api/supplies/:id` |

### Shop Inventory
| Method | Route |
|--------|-------|
| GET | `/api/shops/:shopId/inventory-in` |
| POST | `/api/shops/:shopId/inventory-in` |
| PUT | `/api/shops/:shopId/inventory-in/:id` |
| DELETE | `/api/shops/:shopId/inventory-in/:id` |

### Preparations
| Method | Route |
|--------|-------|
| GET | `/api/shops/:shopId/preparations` |
| POST | `/api/shops/:shopId/preparations` |
| DELETE | `/api/shops/:shopId/preparations/:prepId` |

### Sales
| Method | Route |
|--------|-------|
| GET | `/api/shops/:shopId/sales?date=2026-03-31` |
| POST | `/api/shops/:shopId/sales` |
| PUT | `/api/shops/:shopId/sales/:saleId` |
| DELETE | `/api/shops/:shopId/sales/:saleId` ← soft delete |
| GET | `/api/shops/:shopId/sales/:saleId/receipt` ← PDF download |

### Daily Costs
| Method | Route |
|--------|-------|
| GET | `/api/shops/:shopId/daily-costs?month=2026-03` |
| POST | `/api/shops/:shopId/daily-costs` |
| DELETE | `/api/shops/:shopId/daily-costs/:costId` ← soft delete |

### Counter Cash
| Method | Route |
|--------|-------|
| GET | `/api/shops/:shopId/counter-cash?date=2026-03-31` |
| POST | `/api/shops/:shopId/counter-cash` |

### Settings
| Method | Route |
|--------|-------|
| GET | `/api/settings/selling-costs?shopId=xxx` |
| PUT | `/api/settings/selling-costs` |

### Reports
| Method | Route |
|--------|-------|
| GET | `/api/reports/sales-summary?shopId=&from=&to=` |
| GET | `/api/reports/costs-summary?shopId=&month=` |
| GET | `/api/reports/inventory-summary?shopId=` |
| GET | `/api/reports/counter-cash-summary` |

### Dashboard
| Method | Route |
|--------|-------|
| GET | `/api/dashboard/summary` |

### Health Check
| Method | Route |
|--------|-------|
| GET | `/api/health` |
