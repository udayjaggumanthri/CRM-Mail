#!/usr/bin/env node

/**
 * Migration script to add email template fields to conferences
 * Run this script to update the database schema
 */

const path = require('path');
const { addTemplatesToConferences } = require('./server/database/migrations/add-templates-to-conferences');

console.log('🚀 Starting template migration...');
console.log('This will add stage1Template and stage2Template fields to the conferences table');
console.log('');

addTemplatesToConferences()
  .then(() => {
    console.log('');
    console.log('✅ Migration completed successfully!');
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
    console.error('');
    console.error('❌ Migration failed:', error.message);
    console.error('');
    console.error('Please check:');
    console.error('1. Database connection is working');
    console.error('2. You have permission to alter the conferences table');
    console.error('3. The conferences table exists');
    process.exit(1);
  });
