const { Email, Client, EmailAccount } = require('./models');

async function testEmailAPI() {
  try {
    console.log('Testing Email API...');
    
    // Test 1: Check if models are loaded
    console.log('Email model:', Email);
    console.log('Client model:', Client);
    console.log('EmailAccount model:', EmailAccount);
    
    // Test 2: Try to find emails without associations
    console.log('\nTesting basic Email.findAll...');
    const basicEmails = await Email.findAll();
    console.log('Basic emails found:', basicEmails.length);
    
    // Test 3: Try to find emails with associations
    console.log('\nTesting Email.findAll with associations...');
    const emails = await Email.findAll({
      include: [
        { model: Client, as: 'client', attributes: ['id', 'firstName', 'lastName', 'email'] },
        { model: EmailAccount, as: 'emailAccount', attributes: ['id', 'name', 'email'] }
      ],
      order: [['date', 'DESC']]
    });
    
    console.log('Emails with associations found:', emails.length);
    console.log('Success! Email API is working.');
    
  } catch (error) {
    console.error('Email API test failed:');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

testEmailAPI().then(() => {
  console.log('Test completed');
  process.exit(0);
}).catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
