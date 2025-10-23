#!/usr/bin/env node

/**
 * Migration script to update conference templates to use template IDs
 * Run this script to update the database schema to use dropdown selection
 */

const { updateConferenceTemplatesToIds } = require('./server/database/migrations/update-conference-templates-to-ids');

console.log('🚀 Starting template ID migration...');
console.log('This will update conference templates to use dropdown selection from existing templates');
console.log('');

updateConferenceTemplatesToIds()
  .then(() => {
    console.log('');
    console.log('✅ Migration completed successfully!');
    console.log('📧 Conference templates now use dropdown selection');
    console.log('');
    console.log('Next steps:');
    console.log('1. Restart your server');
    console.log('2. Go to Conference Management');
    console.log('3. Create or edit a conference');
    console.log('4. Select templates from the dropdown menus');
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
