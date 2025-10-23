const axios = require('axios');

// Debug the email system step by step
async function debugEmailSystem() {
  try {
    console.log('🔍 DEBUGGING EMAIL SYSTEM...\n');

    const baseURL = 'http://localhost:5000';
    
    // Step 1: Check if server is running
    console.log('1. Checking server status...');
    try {
      const response = await axios.get(`${baseURL}/api/test`);
      console.log('✅ Server is running:', response.data.message);
    } catch (error) {
      console.log('❌ Server is not running or not accessible');
      console.log('   Make sure to start the server: npm start (in server directory)');
      return;
    }

    // Step 2: Check SMTP accounts
    console.log('\n2. Checking SMTP accounts...');
    try {
      // You'll need to replace with actual JWT token
      const token = 'YOUR_JWT_TOKEN_HERE';
      const response = await axios.get(`${baseURL}/api/smtp-accounts`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.data && response.data.length > 0) {
        console.log('✅ SMTP accounts found:', response.data.length);
        const activeAccounts = response.data.filter(acc => acc.isActive);
        console.log('✅ Active SMTP accounts:', activeAccounts.length);
        if (activeAccounts.length === 0) {
          console.log('❌ No active SMTP accounts found!');
          console.log('   Go to Settings → Email Accounts → Create SMTP account');
          console.log('   Make sure to set isActive: true');
        }
      } else {
        console.log('❌ No SMTP accounts found!');
        console.log('   Go to Settings → Email Accounts → Create SMTP account');
      }
    } catch (error) {
      console.log('❌ Error checking SMTP accounts:', error.message);
      console.log('   Make sure you have a valid JWT token');
    }

    // Step 3: Check conferences and templates
    console.log('\n3. Checking conferences and templates...');
    try {
      const token = 'YOUR_JWT_TOKEN_HERE';
      const conferencesResponse = await axios.get(`${baseURL}/api/conferences`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (conferencesResponse.data && conferencesResponse.data.length > 0) {
        console.log('✅ Conferences found:', conferencesResponse.data.length);
        
        // Check for conferences with initial templates
        const conferencesWithTemplates = conferencesResponse.data.filter(conf => conf.initialTemplateId);
        console.log('✅ Conferences with initial templates:', conferencesWithTemplates.length);
        
        if (conferencesWithTemplates.length === 0) {
          console.log('❌ No conferences have initial templates mapped!');
          console.log('   Go to Conferences → Edit Conference → Map Initial Template');
        }
      } else {
        console.log('❌ No conferences found!');
        console.log('   Go to Conferences → Create Conference');
      }
    } catch (error) {
      console.log('❌ Error checking conferences:', error.message);
    }

    // Step 4: Check email templates
    console.log('\n4. Checking email templates...');
    try {
      const token = 'YOUR_JWT_TOKEN_HERE';
      const templatesResponse = await axios.get(`${baseURL}/api/templates`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (templatesResponse.data && templatesResponse.data.length > 0) {
        console.log('✅ Email templates found:', templatesResponse.data.length);
        
        const initialTemplates = templatesResponse.data.filter(t => t.stage === 'initial_invitation');
        console.log('✅ Initial invitation templates:', initialTemplates.length);
        
        if (initialTemplates.length === 0) {
          console.log('❌ No initial invitation templates found!');
          console.log('   Go to Templates → Create Template → Set stage to "Initial Invitation"');
        }
      } else {
        console.log('❌ No email templates found!');
        console.log('   Go to Templates → Create Template');
      }
    } catch (error) {
      console.log('❌ Error checking templates:', error.message);
    }

    // Step 5: Test client creation
    console.log('\n5. Testing client creation...');
    console.log('   To test client creation:');
    console.log('   1. Go to Clients → Add Client');
    console.log('   2. Fill in client details');
    console.log('   3. Select a conference with initial template mapped');
    console.log('   4. Submit the form');
    console.log('   5. Check server console for email sending logs');

    console.log('\n📋 DEBUGGING CHECKLIST:');
    console.log('□ Server is running on port 5000');
    console.log('□ Database is initialized');
    console.log('□ At least one SMTP account is configured and active');
    console.log('□ At least one conference exists');
    console.log('□ At least one conference has initial template mapped');
    console.log('□ At least one initial invitation template exists');
    console.log('□ Client is assigned to conference when created');
    console.log('□ Server console shows email sending logs');

    console.log('\n🔧 COMMON FIXES:');
    console.log('1. Create SMTP account: Settings → Email Accounts → Create');
    console.log('2. Create template: Templates → Create → Set stage to "Initial Invitation"');
    console.log('3. Map template to conference: Conferences → Edit → Map Initial Template');
    console.log('4. Check server logs for specific error messages');

  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  }
}

// Run the debug
debugEmailSystem();
