#!/usr/bin/env node

/**
 * Script to remove all demo/pre-built email template data
 * This ensures a clean slate for the 3-stage template system
 */

const { EmailTemplate, Conference, sequelize } = require('./server/models');

async function cleanDemoTemplates() {
  try {
    console.log('🧹 Starting demo template cleanup...');
    
    // Check current template count
    const templateCount = await EmailTemplate.count();
    console.log(`📊 Found ${templateCount} existing templates`);
    
    if (templateCount === 0) {
      console.log('✅ No templates to clean - database is already clean');
      return;
    }
    
    // List existing templates
    const existingTemplates = await EmailTemplate.findAll({
      attributes: ['id', 'name', 'stage', 'createdBy']
    });
    
    console.log('\n📋 Existing templates:');
    existingTemplates.forEach(template => {
      console.log(`   - ${template.name} (${template.stage}) - ID: ${template.id}`);
    });
    
    // Remove all templates
    await EmailTemplate.destroy({
      where: {},
      force: true // Hard delete
    });
    
    console.log('\n🗑️  All demo templates removed');
    
    // Reset conference template references
    await Conference.update({
      initialTemplateId: null,
      stage1TemplateId: null,
      stage2TemplateId: null
    }, {
      where: {}
    });
    
    console.log('🔄 Conference template references cleared');
    
    // Verify cleanup
    const remainingTemplates = await EmailTemplate.count();
    console.log(`\n✅ Cleanup complete! Remaining templates: ${remainingTemplates}`);
    
    console.log('\n🎯 Next steps:');
    console.log('1. Go to Templates page');
    console.log('2. Create new templates for each stage:');
    console.log('   - Initial Invitation');
    console.log('   - Abstract Submission (Stage 1)');
    console.log('   - Registration (Stage 2)');
    console.log('3. Assign templates to conferences');
    
  } catch (error) {
    console.error('❌ Error cleaning demo templates:', error);
    throw error;
  }
}

// Run cleanup if called directly
if (require.main === module) {
  cleanDemoTemplates()
    .then(() => {
      console.log('\n🎉 Demo template cleanup completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Cleanup failed:', error.message);
      process.exit(1);
    });
}

module.exports = { cleanDemoTemplates };
