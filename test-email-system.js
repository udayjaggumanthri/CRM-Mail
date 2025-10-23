const axios = require('axios');

// Test the automatic email system
async function testEmailSystem() {
  try {
    console.log('🧪 Testing Automatic Email System...\n');

    // First, let's check if we have any clients and conferences
    console.log('1. Checking available clients and conferences...');
    
    const baseURL = 'http://localhost:5000';
    
    // You'll need to replace these with actual IDs from your database
    const testData = {
      clientId: 'your-client-id-here', // Replace with actual client ID
      conferenceId: 'your-conference-id-here' // Replace with actual conference ID
    };

    console.log('2. Testing automatic email endpoint...');
    console.log('   Make sure you have:');
    console.log('   - A client with ID:', testData.clientId);
    console.log('   - A conference with ID:', testData.conferenceId);
    console.log('   - The conference has an initial template mapped');
    console.log('   - An active SMTP account configured');
    console.log('   - The server is running on port 5000');
    console.log('   - You have a valid JWT token');

    // Uncomment the following lines when you have the actual IDs and token
    /*
    const response = await axios.post(`${baseURL}/api/test-automatic-email`, {
      clientId: testData.clientId,
      conferenceId: testData.conferenceId
    }, {
      headers: {
        'Authorization': 'Bearer YOUR_JWT_TOKEN_HERE',
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Test successful:', response.data);
    */

    console.log('\n📋 Manual Testing Steps:');
    console.log('1. Start your server: npm start (in server directory)');
    console.log('2. Make sure you have an SMTP account configured');
    console.log('3. Create a conference with an initial template mapped');
    console.log('4. Add a client to that conference');
    console.log('5. Check the server logs for email sending messages');
    console.log('6. Check your email inbox for the automatic email');

    console.log('\n🔍 Debugging Checklist:');
    console.log('□ Server is running on port 5000');
    console.log('□ Database is initialized');
    console.log('□ SMTP account is configured and active');
    console.log('□ Conference has initial template mapped');
    console.log('□ Client is assigned to conference');
    console.log('□ Check server console for error messages');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
testEmailSystem();
