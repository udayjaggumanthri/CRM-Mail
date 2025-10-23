const { sequelize } = require('../../config/database');

async function addTemplatesToConferences() {
  try {
    console.log('Adding template fields to conferences table...');
    
    // Add stage1Template column
    await sequelize.query(`
      ALTER TABLE conferences 
      ADD COLUMN stage1Template JSON DEFAULT (JSON_OBJECT(
        'subject', 'Invitation to Submit Abstract - {{conference_name}}',
        'bodyHtml', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;"><h2 style="color: #2563eb;">Dear {{client_name}},</h2><p>We are excited to invite you to submit an abstract for <strong>{{conference_name}}</strong>.</p><p><strong>Conference Details:</strong></p><ul><li><strong>Date:</strong> {{conference_date}}</li><li><strong>Venue:</strong> {{conference_venue}}</li><li><strong>Abstract Deadline:</strong> {{abstract_deadline}}</li></ul><p>Please submit your abstract by clicking the link below:</p><p style="text-align: center; margin: 30px 0;"><a href="{{abstract_submission_link}}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Submit Abstract</a></p><p>We look forward to your participation!</p><p>Best regards,<br>Conference Organizing Committee</p><hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;"><p style="font-size: 12px; color: #6b7280;"><a href="{{unsubscribe_link}}">Unsubscribe</a> | <a href="{{conference_website}}">Conference Website</a></p></div>',
        'bodyText', 'Dear {{client_name}},\n\nWe are excited to invite you to submit an abstract for {{conference_name}}.\n\nConference Details:\n- Date: {{conference_date}}\n- Venue: {{conference_venue}}\n- Abstract Deadline: {{abstract_deadline}}\n\nPlease submit your abstract by visiting: {{abstract_submission_link}}\n\nWe look forward to your participation!\n\nBest regards,\nConference Organizing Committee\n\n---\nUnsubscribe: {{unsubscribe_link}}\nConference Website: {{conference_website}}'
      ))
    `);
    
    // Add stage2Template column
    await sequelize.query(`
      ALTER TABLE conferences 
      ADD COLUMN stage2Template JSON DEFAULT (JSON_OBJECT(
        'subject', 'Registration Reminder - {{conference_name}}',
        'bodyHtml', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;"><h2 style="color: #059669;">Dear {{client_name}},</h2><p>Thank you for submitting your abstract for <strong>{{conference_name}}</strong>!</p><p>We are pleased to inform you that your abstract has been accepted. Now it\'s time to complete your registration.</p><p><strong>Registration Details:</strong></p><ul><li><strong>Conference:</strong> {{conference_name}}</li><li><strong>Date:</strong> {{conference_date}}</li><li><strong>Venue:</strong> {{conference_venue}}</li><li><strong>Registration Deadline:</strong> {{registration_deadline}}</li></ul><p>Please complete your registration by clicking the link below:</p><p style="text-align: center; margin: 30px 0;"><a href="{{registration_link}}" style="background-color: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Complete Registration</a></p><p>We look forward to seeing you at the conference!</p><p>Best regards,<br>Conference Organizing Committee</p><hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;"><p style="font-size: 12px; color: #6b7280;"><a href="{{unsubscribe_link}}">Unsubscribe</a> | <a href="{{conference_website}}">Conference Website</a></p></div>',
        'bodyText', 'Dear {{client_name}},\n\nThank you for submitting your abstract for {{conference_name}}!\n\nWe are pleased to inform you that your abstract has been accepted. Now it\'s time to complete your registration.\n\nRegistration Details:\n- Conference: {{conference_name}}\n- Date: {{conference_date}}\n- Venue: {{conference_venue}}\n- Registration Deadline: {{registration_deadline}}\n\nPlease complete your registration by visiting: {{registration_link}}\n\nWe look forward to seeing you at the conference!\n\nBest regards,\nConference Organizing Committee\n\n---\nUnsubscribe: {{unsubscribe_link}}\nConference Website: {{conference_website}}'
      ))
    `);
    
    console.log('✅ Template fields added successfully to conferences table');
  } catch (error) {
    console.error('❌ Error adding template fields:', error);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  addTemplatesToConferences()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { addTemplatesToConferences };
