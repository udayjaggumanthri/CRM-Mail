const { testConnection } = require('./config/database');
const { initDatabase } = require('./database/init');

async function testDatabaseConnection() {
  console.log('🔍 Testing MySQL database connection...');
  console.log('📊 Database: crmdb');
  console.log('👤 User: root');
  console.log('🔑 Password: root');
  console.log('🌐 Host: localhost:3306');
  console.log('');

  try {
    // Test basic connection
    const connected = await testConnection();
    
    if (connected) {
      console.log('✅ Basic connection successful!');
      console.log('');
      
      // Test full initialization
      console.log('🔧 Testing full database initialization...');
      await initDatabase();
      console.log('');
      console.log('🎉 Database setup completed successfully!');
      console.log('');
      console.log('📋 Next steps:');
      console.log('1. Start the server: npm start');
      console.log('2. Access the application at http://localhost:3000');
      console.log('3. Login with admin@crm.com / admin123');
    } else {
      console.log('❌ Connection failed!');
      console.log('');
      console.log('🔧 Troubleshooting:');
      console.log('1. Make sure MySQL is running');
      console.log('2. Check if database "crmdb" exists');
      console.log('3. Verify credentials (root/root)');
      console.log('4. Check if port 3306 is available');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('');
    console.log('🔧 Common solutions:');
    console.log('1. Install MySQL if not installed');
    console.log('2. Start MySQL service');
    console.log('3. Create database: CREATE DATABASE crmdb;');
    console.log('4. Check firewall settings');
  }
}

// Run the test
testDatabaseConnection();
