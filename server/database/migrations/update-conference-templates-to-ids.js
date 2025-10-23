const { sequelize } = require('../../config/database');

async function updateConferenceTemplatesToIds() {
  try {
    console.log('Updating conference templates to use template IDs...');
    
    // Drop the old JSON columns (if they exist)
    try {
      await sequelize.query(`ALTER TABLE conferences DROP COLUMN stage1Template`);
    } catch (error) {
      console.log('stage1Template column does not exist, skipping...');
    }
    
    try {
      await sequelize.query(`ALTER TABLE conferences DROP COLUMN stage2Template`);
    } catch (error) {
      console.log('stage2Template column does not exist, skipping...');
    }
    
    // Add the new template ID columns
    await sequelize.query(`
      ALTER TABLE conferences 
      ADD COLUMN stage1TemplateId VARCHAR(255) NULL COMMENT 'Reference to EmailTemplate for Stage 1'
    `);
    
    await sequelize.query(`
      ALTER TABLE conferences 
      ADD COLUMN stage2TemplateId VARCHAR(255) NULL COMMENT 'Reference to EmailTemplate for Stage 2'
    `);
    
    console.log('✅ Conference template fields updated successfully!');
    console.log('📧 Templates now use dropdown selection from existing template system');
  } catch (error) {
    console.error('❌ Error updating template fields:', error);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  updateConferenceTemplatesToIds()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { updateConferenceTemplatesToIds };
