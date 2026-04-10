require('dotenv').config();
const mongoose = require('mongoose');

// Import exact operational models (Do NOT import User or Shop)
const Batch = require('./src/models/Batch.model');
const CentralInventory = require('./src/models/CentralInventory.model');
const InventorySupply = require('./src/models/InventorySupply.model');
const ShopInventory = require('./src/models/ShopInventory.model');
const Preparation = require('./src/models/Preparation.model');
const Sale = require('./src/models/Sale.model');
const CounterCash = require('./src/models/CounterCash.model');
const DailyCost = require('./src/models/DailyCost.model');

const resetDemo = async () => {
  try {
    if (!process.env.MONGO_URI) {
      console.error('❌ MONGO_URI is not defined in .env');
      process.exit(1);
    }

    console.log('⏳ Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB connected successfully!\n');

    console.log('🧨 Starting database reset for operational records...');
    console.log('----------------------------------------------------');

    const collectionsToClear = [
      { name: 'Batch', model: Batch },
      { name: 'CentralInventory', model: CentralInventory },
      { name: 'InventorySupply', model: InventorySupply },
      { name: 'ShopInventory', model: ShopInventory },
      { name: 'Preparation', model: Preparation },
      { name: 'Sale', model: Sale },
      { name: 'CounterCash', model: CounterCash },
      { name: 'DailyCost', model: DailyCost },
    ];

    for (const collection of collectionsToClear) {
      try {
        const result = await collection.model.deleteMany({});
        console.log(`✅ Cleared [${collection.name}]: Deleted ${result.deletedCount} documents.`);
      } catch (err) {
        console.error(`❌ Failed to clear [${collection.name}]: ${err.message}`);
      }
    }

    console.log('----------------------------------------------------');
    console.log('🎉 Reset complete! All operational demo data has been wiped.');
    console.log('🛡️  Safe: Users, Settings, and Shops were NOT modified.');
    console.log('\nYou can now start fresh for your demo presentation!');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Fatal Error during reset:', error.message);
    process.exit(1);
  }
};

resetDemo();
