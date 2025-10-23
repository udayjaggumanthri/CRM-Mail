// Quick fix script for IMAP configuration
// This script will help fix common IMAP hostname issues

const fs = require('fs');
const path = require('path');

console.log('🔧 IMAP Configuration Fix Script');
console.log('================================');

// Common IMAP hostname fixes
const hostnameFixes = {
  'imap@gmail.com': 'imap.gmail.com',
  'gmail.com': 'imap.gmail.com',
  'imap@outlook.com': 'outlook.office365.com',
  'outlook.com': 'outlook.office365.com',
  'hotmail.com': 'outlook.office365.com',
  'imap@yahoo.com': 'imap.mail.yahoo.com',
  'yahoo.com': 'imap.mail.yahoo.com'
};

console.log('\n📧 Common IMAP Configuration Fixes:');
console.log('=====================================');

Object.entries(hostnameFixes).forEach(([wrong, correct]) => {
  console.log(`❌ ${wrong} → ✅ ${correct}`);
});

console.log('\n🔧 How to Fix Your Configuration:');
console.log('==================================');
console.log('1. Go to Settings → IMAP Settings');
console.log('2. Select your Gmail account');
console.log('3. Change IMAP Host from "imap@gmail.com" to "imap.gmail.com"');
console.log('4. Make sure Port is 993 and Security is SSL');
console.log('5. Use App Password (not regular password)');
console.log('6. Click "Test Connection"');

console.log('\n📱 Gmail App Password Setup:');
console.log('============================');
console.log('1. Go to https://myaccount.google.com/');
console.log('2. Security → 2-Step Verification (enable if needed)');
console.log('3. Security → App passwords');
console.log('4. Generate app password for "Mail"');
console.log('5. Use the 16-character password in CRM');

console.log('\n✅ Expected Configuration:');
console.log('==========================');
console.log('IMAP Host: imap.gmail.com');
console.log('IMAP Port: 993');
console.log('Security: SSL');
console.log('Username: your-email@gmail.com');
console.log('Password: your-16-character-app-password');

console.log('\n🚀 After fixing, restart the server and test again!');
