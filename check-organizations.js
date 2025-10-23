const { sequelize } = require('./server/config/database');

async function checkOrganizations() {
  try {
    console.log('🔍 Checking organizations table...');
    
    // Check if organizations table exists
    const [tables] = await sequelize.query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME = 'organizations'
    `);
    
    if (tables.length === 0) {
      console.log('❌ Organizations table does not exist');
      return;
    }
    
    console.log('✅ Organizations table exists');
    
    // Check if default organization exists
    const [orgs] = await sequelize.query(`
      SELECT id, name FROM organizations 
      WHERE id = '00000000-0000-0000-0000-000000000001'
    `);
    
    if (orgs.length === 0) {
      console.log('❌ Default organization does not exist');
      
      // Create default organization
      await sequelize.query(`
        INSERT INTO organizations (id, name, domain, description, status, isActive, subscriptionTier, createdAt, updatedAt)
        VALUES ('00000000-0000-0000-0000-000000000001', 'Default Organization', 'crm.local', 'Default organization for CRM system', 'active', true, 'free', NOW(), NOW())
      `);
      
      console.log('✅ Created default organization');
    } else {
      console.log('✅ Default organization exists:', orgs[0].name);
    }
    
    // Check users without organizationId
    const [usersWithoutOrg] = await sequelize.query(`
      SELECT COUNT(*) as count FROM users WHERE organizationId IS NULL
    `);
    
    console.log(`📊 Users without organizationId: ${usersWithoutOrg[0].count}`);
    
    if (usersWithoutOrg[0].count > 0) {
      // Update users without organizationId
      await sequelize.query(`
        UPDATE users 
        SET organizationId = '00000000-0000-0000-0000-000000000001' 
        WHERE organizationId IS NULL
      `);
      
      console.log('✅ Updated users without organizationId');
    }
    
    console.log('✅ Organizations check completed');
    
  } catch (error) {
    console.error('❌ Error checking organizations:', error);
  } finally {
    await sequelize.close();
    console.log('✅ Database connection closed');
  }
}

checkOrganizations();
