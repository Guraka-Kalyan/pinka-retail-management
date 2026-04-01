require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const User = require('../models/User.model');

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB Connected for seeding');

    // Check if admin already exists
    const existing = await User.findOne({ name: 'admin' });
    if (existing) {
      console.log('⚠️  Admin user already exists. Skipping seed.');
      process.exit(0);
    }

    // Create admin user
    const admin = await User.create({
      name: 'admin',
      passwordHash: 'pinaka123', // Will be hashed by pre-save hook
    });

    console.log('✅ Admin user created:');
    console.log('   Name    : admin');
    console.log('   Password: pinaka123');
    console.log('   ID      :', admin._id.toString());
    console.log('\n🔐 Change password after first login!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seed failed:', error.message);
    process.exit(1);
  }
};

seed();
