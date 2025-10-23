#!/usr/bin/env node

/**
 * Migration script to add initial template support to conferences
 * Run this script to add the initialTemplateId column to the conferences table
 */

const { addInitialTemplateToConferences } = require('./server/database/migrations/add-initial-template-to-conferences');

console.log('🚀 Starting initial template migration...');
console.log('This will add initialTemplateId field to the conferences table');
console.log('');

addInitialTemplateToConferences()
  .then(() => {
    console.log('');
    console.log('✅ Migration completed successfully!');
    console.log('📧 Conference templates now support 3 stages:');
    console.log('   1. Initial Invitation');
    console.log('   2. Stage 1 - Abstract Submission');
    console.log('   3. Stage 2 - Registration');
    console.log('');
    console.log('Next steps:');
    console.log('1. Restart your server');
    console.log('2. Go to Conference Management');
    console.log('3. Create or edit a conference');
    console.log('4. Select templates for all 3 stages');
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
