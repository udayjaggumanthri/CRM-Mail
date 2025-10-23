const { sequelize } = require('./server/config/database');

async function fixUsers() {
  try {
    console.log('🔧 Fixing existing users...');
    
    // Update existing users to have the default organizationId
    await sequelize.query(`
      UPDATE users 
      SET organizationId = '00000000-0000-0000-0000-000000000001' 
      WHERE organizationId IS NULL
    `);
    
    console.log('✅ Updated existing users with default organizationId');
    
    // Also update clients
    await sequelize.query(`
      UPDATE clients 
      SET organizationId = '00000000-0000-0000-0000-000000000001' 
      WHERE organizationId IS NULL
    `);
    
    console.log('✅ Updated existing clients with default organizationId');
    
    // Also update conferences
    await sequelize.query(`
      UPDATE conferences 
      SET organizationId = '00000000-0000-0000-0000-000000000001' 
      WHERE organizationId IS NULL
    `);
    
    console.log('✅ Updated existing conferences with default organizationId');
    
    console.log('✅ All existing records updated successfully');
    
  } catch (error) {
    console.error('❌ Error fixing users:', error);
  } finally {
    await sequelize.close();
    console.log('✅ Database connection closed');
  }
}

fixUsers();
