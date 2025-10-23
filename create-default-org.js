const { sequelize } = require('./server/config/database');

async function createDefaultOrg() {
  try {
    console.log('🔧 Creating default organization...');
    
    // Create default organization without subscriptionTier
    await sequelize.query(`
      INSERT INTO organizations (id, name, domain, description, status, isActive, ownerId, createdAt, updatedAt)
      VALUES ('00000000-0000-0000-0000-000000000001', 'Default Organization', 'crm.local', 'Default organization for CRM system', 'active', true, '00000000-0000-0000-0000-000000000001', NOW(), NOW())
    `);
    
    console.log('✅ Created default organization');
    
    // Update users without organizationId
    await sequelize.query(`
      UPDATE users 
      SET organizationId = '00000000-0000-0000-0000-000000000001' 
      WHERE organizationId IS NULL
    `);
    
    console.log('✅ Updated users with default organizationId');
    
    console.log('✅ Default organization setup completed');
    
  } catch (error) {
    console.error('❌ Error creating default organization:', error);
  } finally {
    await sequelize.close();
    console.log('✅ Database connection closed');
  }
}

createDefaultOrg();
