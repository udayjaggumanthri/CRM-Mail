const axios = require('axios');

// Test the complete client email flow
async function testClientEmailFlow() {
  try {
    console.log('🧪 Testing Client Email Flow...\n');

    // Step 1: Check if we have conferences with templates
    console.log('1️⃣ Checking conferences with templates...');
    const conferencesResponse = await axios.get('http://localhost:5000/api/conferences', {
      headers: { 'Authorization': 'Bearer YOUR_JWT_TOKEN' }
    });
    
    const conferences = conferencesResponse.data;
    console.log(`📊 Found ${conferences.length} conferences`);
    
    conferences.forEach(conf => {
      console.log(`   - ${conf.name}: Initial Template = ${conf.initialTemplate ? conf.initialTemplate.name : 'None'}`);
    });

    // Step 2: Check SMTP accounts
    console.log('\n2️⃣ Checking SMTP accounts...');
    const debugResponse = await axios.post('http://localhost:5000/api/debug-email');
    console.log(`📧 SMTP Accounts: ${debugResponse.data.smtpAccounts}`);
    console.log(`📧 Conferences: ${debugResponse.data.conferences}`);
    console.log(`📧 Initial Templates: ${debugResponse.data.initialTemplates}`);

    // Step 3: Find a conference with initial template
    const conferenceWithTemplate = conferences.find(c => c.initialTemplate);
    if (!conferenceWithTemplate) {
      console.log('❌ No conferences with initial templates found!');
      console.log('💡 Solution: Create a conference and map an initial template');
      return;
    }

    console.log(`\n3️⃣ Found conference with template: ${conferenceWithTemplate.name}`);
    console.log(`   Initial Template: ${conferenceWithTemplate.initialTemplate.name}`);

    // Step 4: Test client creation with conference
    console.log('\n4️⃣ Testing client creation with conference...');
    const testClient = {
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      phone: '1234567890',
      country: 'Test Country',
      organization: 'Test Org',
      position: 'Test Position',
      conferenceId: conferenceWithTemplate.id,
      status: 'Lead'
    };

    console.log('📤 Creating test client...');
    console.log('   Conference ID:', testClient.conferenceId);
    console.log('   Email:', testClient.email);

    // Note: This would require authentication in real scenario
    console.log('\n✅ Test setup complete!');
    console.log('💡 To test: Create a client and assign them to a conference with an initial template');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testClientEmailFlow();
