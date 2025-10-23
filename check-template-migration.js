#!/usr/bin/env node

/**
 * Check if template migration is needed
 * This script checks if the template fields already exist in the database
 */

const { addTemplatesToConferences } = require('./server/database/migrations/add-templates-to-conferences');

console.log('🔍 Checking if template migration is needed...');
console.log('');

// Check if columns exist by trying to add them (they'll fail if they exist)
addTemplatesToConferences()
  .then(() => {
    console.log('');
    console.log('✅ Template fields added successfully!');
    console.log('📧 Email templates are now available for conferences');
    console.log('');
    console.log('Next steps:');
    console.log('1. Restart your server');
    console.log('2. Go to Conference Management');
    console.log('3. Click the email template icon on any conference');
    console.log('4. Configure Stage 1 and Stage 2 email templates');
    process.exit(0);
  })
  .catch((error) => {
    if (error.message && error.message.includes('Duplicate column name')) {
      console.log('');
      console.log('✅ Template fields already exist in the database!');
      console.log('📧 Email templates are already available for conferences');
      console.log('');
      console.log('You can now:');
      console.log('1. Go to Conference Management');
      console.log('2. Click the email template icon on any conference');
      console.log('3. Configure Stage 1 and Stage 2 email templates');
      process.exit(0);
    } else {
      console.error('');
      console.error('❌ Migration failed:', error.message);
      console.error('');
      console.error('Please check:');
      console.error('1. Database connection is working');
      console.error('2. You have permission to alter the conferences table');
      console.error('3. The conferences table exists');
      process.exit(1);
    }
  });
