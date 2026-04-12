const mongoose = require('mongoose');
require('dotenv').config();

const Sale = require('../models/Sale.model');
const DailyCost = require('../models/DailyCost.model');
const ShopInventory = require('../models/ShopInventory.model');
const Preparation = require('../models/Preparation.model');
const CentralInventory = require('../models/CentralInventory.model');
const CounterCash = require('../models/CounterCash.model');
const Batch = require('../models/Batch.model');
const InventorySupply = require('../models/InventorySupply.model');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
    console.log("Connected to MongoDB. Wiping analytical data...");
    
    await Sale.deleteMany({});
    console.log("Deleted all Sales...");
    
    await DailyCost.deleteMany({});
    console.log("Deleted all Daily Costs...");
    
    await ShopInventory.deleteMany({});
    console.log("Deleted all Shop Inventory...");
    
    await Preparation.deleteMany({});
    console.log("Deleted all Preparations...");
    
    await CentralInventory.deleteMany({});
    console.log("Deleted all Central Inventory...");

    await CounterCash.deleteMany({});
    console.log("Deleted all Counter Cash...");

    await Batch.deleteMany({});
    console.log("Deleted all Batches...");

    await InventorySupply.deleteMany({});
    console.log("Deleted all Inventory Supplies...");

    console.log("✅ All reports and inventory data wiped successfully! Shops and Users have been kept intact.");
    process.exit(0);
}).catch(console.error);
