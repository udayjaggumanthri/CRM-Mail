# 📧 Three-Template Email System Guide

## Overview

The Conference CRM now supports a comprehensive 3-stage email template system for managing conference communications:

1. **Initial Invitation** - First contact with potential participants
2. **Stage 1 - Abstract Submission** - Follow-up for abstract submissions
3. **Stage 2 - Registration** - Final registration reminders

## 🎯 Template Types

### 1. Initial Invitation Template
- **Purpose**: First contact with potential conference participants
- **Stage**: `initial_invitation`
- **When Used**: Initial outreach to invite people to the conference
- **Content**: Conference overview, dates, venue, call-to-action

### 2. Stage 1 - Abstract Submission Template
- **Purpose**: Follow-up for abstract submissions
- **Stage**: `abstract_submission`
- **When Used**: After initial invitation, to encourage abstract submissions
- **Content**: Abstract submission details, deadlines, guidelines

### 3. Stage 2 - Registration Template
- **Purpose**: Final registration reminders
- **Stage**: `registration`
- **When Used**: After abstract acceptance, to complete registration
- **Content**: Registration details, payment information, final steps

## 🚀 How to Use

### Creating Templates

1. **Go to Templates Page**
   - Navigate to "Templates" in the sidebar
   - Click "Create Template" button

2. **Select Template Stage**
   - Choose from dropdown:
     - "Initial Invitation" - for first contact
     - "Abstract Submission" - for stage 1 follow-up
     - "Registration" - for stage 2 follow-up

3. **Create Template Content**
   - Enter template name
   - Write email subject
   - Create HTML and text versions
   - Use available variables (see below)

### Assigning Templates to Conferences

1. **Create/Edit Conference**
   - Go to "Conferences" page
   - Click "Add Conference" or edit existing conference

2. **Select Templates**
   - **Initial Invitation Template**: Choose from dropdown
   - **Stage 1 Template**: Choose from dropdown
   - **Stage 2 Template**: Choose from dropdown

3. **Preview Templates**
   - Each selected template shows a preview
   - Subject and content preview available
   - Template management link provided

## 📝 Available Variables

All templates support these variables:

### Client Variables
- `{{client_name}}` - Client's full name
- `{{client_email}}` - Client's email address
- `{{client_country}}` - Client's country

### Conference Variables
- `{{conference_name}}` - Conference name
- `{{conference_date}}` - Conference date
- `{{conference_venue}}` - Conference venue
- `{{conference_website}}` - Conference website

### Deadline Variables
- `{{abstract_deadline}}` - Abstract submission deadline
- `{{registration_deadline}}` - Registration deadline

### Action Variables
- `{{abstract_submission_link}}` - Link to submit abstract
- `{{registration_link}}` - Link to complete registration
- `{{unsubscribe_link}}` - Unsubscribe link

## 🔧 Technical Implementation

### Database Schema

```sql
-- Conference table
ALTER TABLE conferences ADD COLUMN initialTemplateId VARCHAR(255) NULL;
ALTER TABLE conferences ADD COLUMN stage1TemplateId VARCHAR(255) NULL;
ALTER TABLE conferences ADD COLUMN stage2TemplateId VARCHAR(255) NULL;

-- EmailTemplate table
ALTER TABLE email_templates MODIFY COLUMN stage ENUM('initial_invitation', 'abstract_submission', 'registration');
```

### API Endpoints

- `GET /api/conferences` - Returns conferences with template data
- `POST /api/conferences` - Creates conference with template IDs
- `PUT /api/conferences/:id` - Updates conference with template IDs
- `GET /api/templates` - Returns all templates filtered by stage

### Frontend Components

- **ConferenceManagement.js** - 3-template dropdown selection
- **Templates.js** - Template creation with 3 stages
- Template preview and management integration

## 📋 Workflow Example

### 1. Create Templates
```
Initial Invitation Template:
- Name: "Conference Invitation 2024"
- Stage: "initial_invitation"
- Subject: "You're Invited to {{conference_name}}"
- Content: Welcome message with conference details

Stage 1 Template:
- Name: "Abstract Submission Reminder"
- Stage: "abstract_submission"
- Subject: "Submit Your Abstract for {{conference_name}}"
- Content: Abstract submission details and deadline

Stage 2 Template:
- Name: "Registration Reminder"
- Stage: "registration"
- Subject: "Complete Your Registration for {{conference_name}}"
- Content: Registration details and payment info
```

### 2. Create Conference
```
Conference: "Tech Conference 2024"
- Initial Template: "Conference Invitation 2024"
- Stage 1 Template: "Abstract Submission Reminder"
- Stage 2 Template: "Registration Reminder"
```

### 3. Email Campaign Flow
```
1. Send Initial Invitation → Wait for response
2. Send Stage 1 (Abstract) → Wait for submission
3. Send Stage 2 (Registration) → Complete registration
```

## 🎨 UI Features

### Conference Management
- **3 Template Dropdowns**: One for each stage
- **Template Previews**: Show selected template content
- **Template Management**: Direct link to template creation
- **Responsive Design**: Works on all screen sizes

### Template Management
- **Stage Selection**: Choose from 3 stages
- **Template Variables**: List of available variables
- **Preview Functionality**: See template before saving
- **Reusability**: Templates can be used across conferences

## 🔄 Migration Status

✅ **Completed Migrations:**
- Added `initialTemplateId` column to conferences table
- Updated EmailTemplate model to support 3 stages
- Updated API endpoints for 3 template types
- Updated frontend UI for 3 template selection

## 🚀 Next Steps

1. **Restart Server**: Restart your application server
2. **Create Templates**: Go to Templates page and create templates for each stage
3. **Test Conference**: Create a conference and assign templates
4. **Verify Workflow**: Test the complete 3-stage email workflow

## 📞 Support

If you encounter any issues:
1. Check database connection
2. Verify template creation
3. Test conference creation with templates
4. Check browser console for errors

The 3-template system is now fully functional and ready to use! 🎉
