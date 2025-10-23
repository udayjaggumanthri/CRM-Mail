const { sequelize } = require('./server/config/database');

async function testConnection() {
  try {
    console.log('🔄 Testing database connection...');
    
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully');
    
    // Test a simple query
    const [results] = await sequelize.query('SELECT COUNT(*) as count FROM conferences');
    console.log('✅ Conferences table accessible:', results[0]);
    
    // Test clients table
    const [clientResults] = await sequelize.query('SELECT COUNT(*) as count FROM clients');
    console.log('✅ Clients table accessible:', clientResults[0]);
    
    // Test email_templates table
    const [templateResults] = await sequelize.query('SELECT COUNT(*) as count FROM email_templates');
    console.log('✅ Email templates table accessible:', templateResults[0]);
    
    // Test email_accounts table
    const [accountResults] = await sequelize.query('SELECT COUNT(*) as count FROM email_accounts');
    console.log('✅ Email accounts table accessible:', accountResults[0]);
    
    await sequelize.close();
    console.log('✅ Database connection closed');
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('Full error:', error);
  }
}

testConnection();
