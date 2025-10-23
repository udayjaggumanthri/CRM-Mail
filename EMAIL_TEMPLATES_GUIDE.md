# 📧 Email Templates for Conferences - Setup Guide

This guide explains how to use the new email template feature for conferences in the CRM system.

## 🎯 Overview

The email template feature allows you to configure **Stage 1** and **Stage 2** email templates directly within each conference. These templates are used for automated follow-up campaigns.

### Stage 1: Abstract Submission
- **Purpose**: Invite clients to submit abstracts
- **Timing**: Sent when clients are first added to a conference
- **Goal**: Encourage abstract submissions

### Stage 2: Registration
- **Purpose**: Remind clients to complete registration
- **Timing**: Sent after abstract acceptance
- **Goal**: Convert accepted abstracts to registrations

## 🚀 Setup Instructions

### 1. Run Database Migration

First, you need to add the template fields to your database:

```bash
# Navigate to the project root
cd crm1

# Run the migration script
node run-template-migration.js
```

### 2. Restart Your Server

After running the migration, restart your server:

```bash
# Stop your current server (Ctrl+C)
# Then restart
npm start
```

### 3. Access Template Management

1. Go to **Conference Management** in your CRM
2. Find any conference in the list
3. Click the **email template icon** (📧) next to the conference
4. Configure your Stage 1 and Stage 2 templates

## 📝 Template Configuration

### Available Variables

You can use these variables in your email templates:

| Variable | Description | Example |
|----------|-------------|---------|
| `{{client_name}}` | Client's full name | "Dr. John Smith" |
| `{{conference_name}}` | Conference name | "AI Conference 2024" |
| `{{conference_date}}` | Conference dates | "March 15-17, 2024" |
| `{{conference_venue}}` | Conference venue | "Convention Center, New York" |
| `{{abstract_deadline}}` | Abstract submission deadline | "February 15, 2024" |
| `{{registration_deadline}}` | Registration deadline | "March 1, 2024" |
| `{{abstract_submission_link}}` | Link to abstract submission | "https://conference.com/submit" |
| `{{registration_link}}` | Link to registration | "https://conference.com/register" |
| `{{conference_website}}` | Conference website | "https://conference.com" |
| `{{unsubscribe_link}}` | Unsubscribe link | "https://conference.com/unsubscribe" |

### Template Structure

Each template has three parts:

1. **Subject Line**: The email subject
2. **HTML Body**: Rich HTML email content
3. **Text Body**: Plain text version for email clients that don't support HTML

## 🎨 Template Examples

### Stage 1 Template (Abstract Submission)

**Subject**: `Invitation to Submit Abstract - {{conference_name}}`

**HTML Body**:
```html
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #2563eb;">Dear {{client_name}},</h2>
  <p>We are excited to invite you to submit an abstract for <strong>{{conference_name}}</strong>.</p>
  
  <p><strong>Conference Details:</strong></p>
  <ul>
    <li><strong>Date:</strong> {{conference_date}}</li>
    <li><strong>Venue:</strong> {{conference_venue}}</li>
    <li><strong>Abstract Deadline:</strong> {{abstract_deadline}}</li>
  </ul>
  
  <p>Please submit your abstract by clicking the link below:</p>
  <p style="text-align: center; margin: 30px 0;">
    <a href="{{abstract_submission_link}}" 
       style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
      Submit Abstract
    </a>
  </p>
  
  <p>We look forward to your participation!</p>
  <p>Best regards,<br>Conference Organizing Committee</p>
</div>
```

### Stage 2 Template (Registration)

**Subject**: `Registration Reminder - {{conference_name}}`

**HTML Body**:
```html
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #059669;">Dear {{client_name}},</h2>
  <p>Thank you for submitting your abstract for <strong>{{conference_name}}</strong>!</p>
  <p>We are pleased to inform you that your abstract has been accepted. Now it's time to complete your registration.</p>
  
  <p><strong>Registration Details:</strong></p>
  <ul>
    <li><strong>Conference:</strong> {{conference_name}}</li>
    <li><strong>Date:</strong> {{conference_date}}</li>
    <li><strong>Venue:</strong> {{conference_venue}}</li>
    <li><strong>Registration Deadline:</strong> {{registration_deadline}}</li>
  </ul>
  
  <p>Please complete your registration by clicking the link below:</p>
  <p style="text-align: center; margin: 30px 0;">
    <a href="{{registration_link}}" 
       style="background-color: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
      Complete Registration
    </a>
  </p>
  
  <p>We look forward to seeing you at the conference!</p>
  <p>Best regards,<br>Conference Organizing Committee</p>
</div>
```

## 🔧 Technical Details

### Database Changes

The migration adds two new JSON columns to the `conferences` table:

- `stage1Template`: Stores Stage 1 email template data
- `stage2Template`: Stores Stage 2 email template data

### API Endpoints

- `PUT /api/conferences/:id/templates`: Update conference templates
- `GET /api/conferences`: Now includes template data in response

### Frontend Components

- **ConferenceManagement.js**: Updated with template management modal
- **Template Modal**: New interface for editing templates
- **Stage Tabs**: Switch between Stage 1 and Stage 2 templates

## 🚨 Troubleshooting

### Migration Issues

If the migration fails:

1. **Check Database Connection**: Ensure your database is running and accessible
2. **Check Permissions**: Ensure your database user can alter tables
3. **Check Table Exists**: Verify the `conferences` table exists

### Template Issues

If templates don't save:

1. **Check Server Logs**: Look for error messages in the console
2. **Verify API Endpoint**: Ensure the template update endpoint is working
3. **Check Database**: Verify the template fields were added successfully

### Frontend Issues

If the template modal doesn't appear:

1. **Check Console**: Look for JavaScript errors
2. **Verify Dependencies**: Ensure all React components are properly imported
3. **Check Network**: Verify API calls are being made successfully

## 📚 Next Steps

After setting up templates:

1. **Test Templates**: Send test emails to verify templates work
2. **Customize Content**: Adjust templates to match your conference style
3. **Set Up Campaigns**: Use the templates in your email campaigns
4. **Monitor Results**: Track email open rates and click-through rates

## 🎉 Benefits

- **Centralized Management**: All templates in one place per conference
- **Easy Customization**: Simple interface for editing templates
- **Variable Support**: Dynamic content with conference-specific data
- **HTML & Text**: Support for both rich and plain text emails
- **Stage-based**: Different templates for different follow-up stages

## 📞 Support

If you encounter any issues:

1. Check the server logs for error messages
2. Verify your database connection
3. Ensure all dependencies are installed
4. Check that the migration ran successfully

The email template feature is now ready to use! 🚀
