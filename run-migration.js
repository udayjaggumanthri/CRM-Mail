const { sequelize } = require('./server/config/database');
const migration = require('./server/database/migrations/fix-database-completely');

async function runMigration() {
  try {
    console.log('🚀 Starting database migration...');
    
    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connection established');
    
    // Run the migration
    await migration.up(sequelize.getQueryInterface(), sequelize.constructor);
    console.log('✅ Migration completed successfully');
    
    // Close the connection
    await sequelize.close();
    console.log('✅ Database connection closed');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
