const { sequelize } = require('../../config/database');

async function addInitialTemplateToConferences() {
  try {
    console.log('Adding initial template field to conferences table...');
    
    // Add initialTemplateId column
    await sequelize.query(`
      ALTER TABLE conferences 
      ADD COLUMN initialTemplateId VARCHAR(255) NULL COMMENT 'Reference to EmailTemplate for Initial Invitation'
    `);
    
    console.log('✅ Initial template field added successfully to conferences table');
  } catch (error) {
    if (error.message.includes('Duplicate column name')) {
      console.log('✅ Initial template field already exists, skipping...');
    } else {
      console.error('❌ Error adding initial template field:', error);
      throw error;
    }
  }
}

// Run migration if called directly
if (require.main === module) {
  addInitialTemplateToConferences()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { addInitialTemplateToConferences };
