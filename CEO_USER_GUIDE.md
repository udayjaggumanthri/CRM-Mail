# 🎯 CEO User Guide - Conference CRM System

## 🚨 Current System Status

Your system is currently running in **fallback mode** due to some database schema issues. Here's what you need to do:

---

## ✅ **STEP 1: Access the System**

**Login Credentials:**
```
URL: http://localhost:3000
Email: admin@crm.com
Password: admin123
Role: CEO
```

---

## 📋 **STEP 2: What You Should See After Login**

After logging in as CEO, you should see the following menu items in the sidebar:

1. **Dashboard** - Overview of system activity
2. **Conferences** - Create and manage conferences
3. **Users** ⭐ NEW - Add Team Leads and Members
4. **Clients** - Manage client contacts
5. **Email** - Send and receive emails
6. **Templates** - Create email templates
7. **Campaigns** - Manage email campaigns
8. **Settings** - System configuration

---

## 👥 **STEP 3: Add Team Leaders and Members**

### To Add a New User:

1. Click on **"Users"** in the left sidebar
2. Click the **"+ Add User"** button (top right)
3. Fill in the form:
   - **Full Name**: e.g., "John Smith"
   - **Email**: e.g., "john@company.com"
   - **Password**: Set a secure password
   - **Role**: Choose from:
     - `Member` - Basic access, can manage assigned clients
     - `Team Lead` - Can manage team and conferences
     - `CEO` - Full system access
   - **Phone**: Optional
   - **Department**: e.g., "Sales"
   - **Job Title**: e.g., "Sales Manager"
4. Click **"Add User"**

### Example Users to Create:

```
Team Lead 1:
- Name: Sarah Johnson
- Email: sarah@company.com
- Role: Team Lead
- Department: Sales
- Job Title: Sales Team Lead

Member 1:
- Name: Mike Chen
- Email: mike@company.com
- Role: Member
- Department: Sales
- Job Title: Sales Representative
```

---

## 🎪 **STEP 4: Create a Conference**

1. Click on **"Conferences"** in the sidebar
2. Click **"+ New Conference"** button
3. Fill in the **Basic Information**:
   - Conference Name: e.g., "Tech Summit 2024"
   - Venue: e.g., "San Francisco Convention Center"
   - Start Date: Select date
   - End Date: Select date
   - Website: e.g., "https://techsummit2024.com"

4. Scroll to **"Follow-up Settings"** section:
   - **Stage 1 (Abstract Submission)**:
     - Interval Days: `7` (emails every 7 days)
     - Max Follow-ups: `6` (maximum 6 emails)
   
   - **Stage 2 (Registration)**:
     - Interval Days: `3` (emails every 3 days)
     - Max Follow-ups: `6` (maximum 6 emails)
   
   - **Global Settings**:
     - ✅ Skip Weekends (enabled)
     - Working Hours Start: `09:00`
     - Working Hours End: `17:00`
     - Timezone: Select your timezone

5. **Assign Email Templates**:
   - Initial Template: Select invitation template
   - Stage 1 Template: Select abstract reminder template
   - Stage 2 Template: Select registration reminder template

6. Click **"Save Conference"**

---

## 📧 **STEP 5: Create Email Templates**

Before creating conferences, you need email templates:

1. Go to **"Templates"** in the sidebar
2. Click **"+ New Template"**
3. Create three templates:

### Template 1: Initial Invitation
```
Name: Conference Invitation
Stage: Initial Invitation
Subject: You're Invited to {{conference.name}}!
Body:
Dear {{client.firstName}},

We're excited to invite you to {{conference.name}} happening on {{conference.startDate}} at {{conference.venue}}.

This is a premier event where industry leaders gather to share insights and innovations.

We'd love to have you join us!

Best regards,
{{conference.contactPerson}}
```

### Template 2: Abstract Submission Reminder
```
Name: Abstract Submission Reminder
Stage: Abstract Submission
Subject: Reminder: Submit Your Abstract for {{conference.name}}
Body:
Dear {{client.firstName}},

This is a friendly reminder to submit your abstract for {{conference.name}}.

Deadline: {{conference.abstractDeadline}}

Submit your abstract here: {{conference.website}}/submit

Looking forward to your contribution!

Best regards,
{{conference.contactPerson}}
```

### Template 3: Registration Reminder
```
Name: Registration Reminder
Stage: Registration
Subject: Complete Your Registration for {{conference.name}}
Body:
Dear {{client.firstName}},

Thank you for submitting your abstract! We're pleased to inform you that it has been received.

Please complete your registration: {{conference.website}}/register

Early bird discount ends soon!

Best regards,
{{conference.contactPerson}}
```

---

## 👤 **STEP 6: Add Clients and Trigger Automation**

1. Go to **"Clients"** in the sidebar
2. Click **"+ Add Client"**
3. Fill in client details:
   - First Name: e.g., "David"
   - Last Name: e.g., "Wilson"
   - Email: e.g., "david@example.com"
   - Phone: e.g., "+1234567890"
   - Country: e.g., "USA"
   - Organization: e.g., "Tech Corp"
   - Position: e.g., "CTO"
   - **Conference**: ⭐ **SELECT YOUR CONFERENCE** (this triggers automation!)
   - Notes: Optional

4. Click **"Save"**

**🎯 What Happens Next:**
- ✅ Initial invitation email is sent immediately
- ✅ Stage 1 follow-up emails scheduled (every 7 days, max 6)
- ✅ Client is automatically tracked
- ✅ When client submits abstract → moves to Stage 2
- ✅ Stage 2 follow-up emails start (every 3 days, max 6)
- ✅ When client registers → automation stops

---

## 📊 **STEP 7: Track Email Status and Stages**

### View Email Logs:
1. Go to **"Email"** in the sidebar
2. Click on **"Sent"** tab to see all sent emails
3. You'll see:
   - To/From addresses
   - Subject line
   - Date sent
   - Status (Sent, Delivered, Opened, etc.)
   - Client name
   - Conference name

### View Client Stages:
1. Go to **"Clients"** in the sidebar
2. Look at the **"Status"** column:
   - `Lead` - Just added, invitation sent
   - `Abstract Submitted` - Submitted abstract, Stage 2 active
   - `Registered` - Completed registration, automation stopped
   - `Unresponsive` - No response after max follow-ups

3. Look at **"Follow-up Count"**:
   - Shows how many follow-up emails have been sent
   - Shows current stage (Stage 1 or Stage 2)

### View Campaign Stats:
1. Go to **"Campaigns"** in the sidebar
2. You'll see:
   - Campaign name
   - Conference assigned
   - Total emails sent
   - Open rate
   - Click rate
   - Current status

---

## 🎯 **STEP 8: Assign Conferences to Team**

1. Go to **"Conferences"** in the sidebar
2. Click on a conference
3. Click **"Assign Team Lead"** button
4. Select a Team Lead from dropdown
5. Click **"Assign Members"** button
6. Select Members to assign
7. Click **"Save"**

Now the Team Lead can:
- Manage assigned conferences
- Add/edit clients for their conferences
- View email performance
- Assign work to members

---

## 📧 **STEP 9: Manual Email Intervention (CEO Oversight)**

As CEO, you can intervene in any email thread:

1. Go to **"Email"** in the sidebar
2. Browse all sent/received emails
3. Click on any email to open it
4. Click **"Reply"** to respond directly
5. Your reply will be part of the thread

---

## 🔍 **STEP 10: Monitor System Performance**

### Dashboard View:
- Total Clients
- Emails Sent Today
- Active Follow-ups
- Conferences Active
- Conversion Rates

### Analytics View:
1. Go to **"Dashboard"** and scroll down
2. You'll see:
   - **Email Performance** chart
   - **Client Status** breakdown
   - **Conference Analytics**
   - **Recent Activity** feed

---

## 🛠️ **Troubleshooting**

### Issue 1: "No Users Menu"
**Solution**: Make sure you're logged in as CEO (admin@crm.com)

### Issue 2: "Emails Not Sending"
**Check**:
1. SMTP account is configured in Settings → Email Accounts
2. Conference has email templates assigned
3. Client has a conference assigned
4. Check Email Logs for error messages

### Issue 3: "Can't See Email Status"
**Solution**:
1. Go to Email → Sent tab
2. Go to Clients → View "Follow-up Count" column
3. Go to Campaigns → View campaign statistics

### Issue 4: "Automation Not Working"
**Check**:
1. Client has conference assigned
2. Conference has follow-up settings configured
3. Email templates are assigned to conference
4. SMTP account is active

---

## 📞 **Quick Reference**

### Default Login:
```
CEO: admin@crm.com / admin123
Manager: manager@crm.com / manager123
Agent: agent@crm.com / agent123
```

### Email Automation Flow:
```
Add Client + Assign Conference
    ↓
Initial Invitation (Immediate)
    ↓
Stage 1: Abstract Submission
    → Every 7 days
    → Max 6 follow-ups
    → Skip weekends
    ↓
[Client Submits Abstract]
    ↓
Stage 2: Registration
    → Every 3 days
    → Max 6 follow-ups
    → Skip weekends
    ↓
[Client Registers]
    ↓
Automation Stops ✅
```

### Menu Navigation:
```
CEO Can Access:
✅ Dashboard
✅ Conferences (create, edit, assign)
✅ Users (add Team Leads, Members)
✅ Clients (all clients, all conferences)
✅ Email (all emails, all threads)
✅ Templates (create, edit)
✅ Campaigns (view all, create)
✅ Settings (SMTP, system config)

Team Lead Can Access:
✅ Dashboard (their conferences)
✅ Conferences (assigned only)
✅ Users (their team members)
✅ Clients (assigned conferences)
✅ Email (assigned conferences)
✅ Templates (view, use)
✅ Campaigns (assigned conferences)

Member Can Access:
✅ Dashboard (assigned conferences)
✅ Conferences (assigned only, view)
✅ Clients (assigned conferences)
✅ Email (assigned conferences)
✅ Templates (view, use)
```

---

## 🎉 **You're All Set!**

Now you can:
- ✅ Add Team Leads and Members
- ✅ Create Conferences with automated follow-ups
- ✅ Add clients and trigger email automation
- ✅ Track email status and client stages
- ✅ Monitor team performance
- ✅ Intervene in any email thread

**Start by creating your first Team Lead, then create a conference, and add some clients to see the automation in action!**

