const mongoose = require('mongoose');
require('dotenv').config();

async function fixAdminRole() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const result = await mongoose.connection.collection('users').updateMany(
    {},  // update ALL users
    [
      {
        $set: {
          role: {
            $cond: {
              if: { $eq: [{ $toLower: '$name' }, 'admin'] },
              then: 'Admin',
              else: { $ifNull: ['$role', 'Staff'] }
            }
          }
        }
      }
    ]
  );

  console.log(`Updated ${result.modifiedCount} user(s).`);

  const users = await mongoose.connection.collection('users').find({}, { projection: { name: 1, role: 1 } }).toArray();
  console.log('Current users:');
  users.forEach(u => console.log(` - ${u.name}: ${u.role}`));

  await mongoose.disconnect();
  console.log('Done.');
}

fixAdminRole().catch(console.error);
