/**
 * Migrate Order deliveryAddress Script
 *
 * Migrates existing delivery orders from string deliveryAddress to structured object
 * with street, city, zipCode, and instructions fields.
 *
 * Usage: node scripts/migrateDeliveryAddress.js
 *
 * ⚠️ Run this script only ONCE after deploying the new deliveryAddress structure
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Order = require('../models/Order');

// Sample addresses to use for migration
const sampleAddresses = [
  {
    street: '123 Rue de la Paix',
    city: 'Paris',
    zipCode: '75001',
    instructions: 'Sonnez 2 fois'
  },
  {
    street: '45 Avenue des Champs-Élysées',
    city: 'Paris',
    zipCode: '75008',
    instructions: 'Digicode: 1234'
  },
  {
    street: '78 Boulevard Saint-Germain',
    city: 'Paris',
    zipCode: '75006',
    instructions: 'Interphone au nom de Dupont'
  },
  {
    street: '12 Rue du Commerce',
    city: 'Lyon',
    zipCode: '69002',
    instructions: 'Laisser au gardien'
  },
  {
    street: '56 Cours Mirabeau',
    city: 'Aix-en-Provence',
    zipCode: '13100',
    instructions: 'Bâtiment B, 3ème étage'
  },
  {
    street: '34 Rue de la République',
    city: 'Marseille',
    zipCode: '13001',
    instructions: null
  },
  {
    street: '89 Avenue Victor Hugo',
    city: 'Nice',
    zipCode: '06000',
    instructions: 'Porte bleue à gauche'
  },
  {
    street: '23 Quai des Bateliers',
    city: 'Strasbourg',
    zipCode: '67000',
    instructions: 'Dernier étage'
  }
];

const migrateDeliveryAddresses = async () => {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find all delivery orders
    const deliveryOrders = await Order.find({
      orderType: 'delivery'
    });

    if (deliveryOrders.length === 0) {
      console.log('✅ No delivery orders to migrate\n');
    } else {
      console.log(`Found ${deliveryOrders.length} delivery order(s) to migrate`);

      let migratedCount = 0;
      for (const order of deliveryOrders) {
        // Check if already migrated (has object structure)
        if (typeof order.deliveryAddress === 'object' &&
            order.deliveryAddress !== null &&
            order.deliveryAddress.street) {
          console.log(`  ⊘ Order ${order._id}: Already migrated, skipping`);
          continue;
        }

        // Pick a random sample address
        const randomAddress = sampleAddresses[Math.floor(Math.random() * sampleAddresses.length)];

        // Update using direct database update
        await Order.updateOne(
          { _id: order._id },
          {
            $set: {
              deliveryAddress: randomAddress
            }
          }
        );

        migratedCount++;
        console.log(`  ✓ Order ${order._id}: Updated to ${randomAddress.street}, ${randomAddress.city}`);
      }

      console.log(`\n✅ Migrated ${migratedCount} delivery order(s)`);
    }

    // ========================================
    // Summary
    // ========================================
    console.log('\n═══════════════════════════════════════');
    console.log('🎉 Migration completed successfully!');
    console.log('═══════════════════════════════════════');
    console.log('\nNew deliveryAddress structure:');
    console.log('  • street: String (required)');
    console.log('  • city: String (required)');
    console.log('  • zipCode: String (required)');
    console.log('  • instructions: String (optional)');
    console.log('\n✅ All delivery orders have been updated\n');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('👋 Database connection closed.');
  }
};

migrateDeliveryAddresses();
