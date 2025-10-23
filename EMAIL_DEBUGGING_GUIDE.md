# 🔧 Email System Debugging Guide

## 🚨 **Issue: Automatic Emails Not Sending**

If automatic emails are not being sent when you add clients, follow this debugging guide:

## 🔍 **Step 1: Check Server Logs**

When you add a client, you should see these logs in your server console:

```
🚀 Starting automatic email for client: client@example.com, conference: conference-id
📧 Conference found: Conference Name
📧 Initial template found: Template Name
📧 SMTP account found: Account Name (account@example.com)
🔧 Initializing EmailService...
🔧 Setting up SMTP connection...
✅ SMTP connection established
🔧 Rendering email template...
📧 Rendered email subject: Welcome to Conference!
🔧 Creating campaign for tracking...
📧 Campaign created: campaign-id
📤 Sending email...
✅ Automatic initial email sent to client@example.com for conference Conference Name
📧 Email ID: email-id
```

**If you don't see these logs, the automatic email function is not being called.**

## 🔍 **Step 2: Check Prerequisites**

### **1. SMTP Account Configuration**
```bash
# Check if you have an active SMTP account
curl -X GET "http://localhost:5000/api/smtp-accounts" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Required:** At least one SMTP account with `isActive: true`

### **2. Conference Template Mapping**
```bash
# Check if conference has initial template mapped
curl -X GET "http://localhost:5000/api/conferences" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Required:** Conference must have `initialTemplateId` set

### **3. Email Template Exists**
```bash
# Check if template exists
curl -X GET "http://localhost:5000/api/templates" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Required:** Template with `stage: 'initial_invitation'`

## 🔍 **Step 3: Test Email System**

### **Manual Test Endpoint**
```bash
# Test automatic email manually
curl -X POST "http://localhost:5000/api/test-automatic-email" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "your-client-id",
    "conferenceId": "your-conference-id"
  }'
```

## 🔍 **Step 4: Common Issues & Solutions**

### **Issue 1: No SMTP Account**
**Error:** `❌ No active SMTP account found for automatic email`

**Solution:**
1. Go to Settings → Email Accounts
2. Create a new SMTP account
3. Set `isActive: true`
4. Configure SMTP settings (Gmail, Outlook, etc.)

### **Issue 2: No Initial Template**
**Error:** `❌ No initial template mapped for conference`

**Solution:**
1. Go to Templates → Create Template
2. Set stage to "Initial Invitation"
3. Go to Conferences → Edit Conference
4. Map the template to "Initial Invitation Template"

### **Issue 3: SMTP Connection Failed**
**Error:** `Error sending email: SMTP connection failed`

**Solution:**
1. Check SMTP credentials
2. Verify SMTP host and port
3. Enable "Less secure app access" for Gmail
4. Use App Passwords for Gmail

### **Issue 4: Template Rendering Error**
**Error:** `Template rendering error`

**Solution:**
1. Check template content for syntax errors
2. Verify template variables are correct
3. Test template rendering manually

## 🔍 **Step 5: SMTP Configuration Examples**

### **Gmail Configuration**
```json
{
  "name": "Gmail Account",
  "email": "your-email@gmail.com",
  "smtpHost": "smtp.gmail.com",
  "smtpPort": 587,
  "smtpUsername": "your-email@gmail.com",
  "smtpPassword": "your-app-password",
  "smtpSecurity": "tls",
  "isActive": true
}
```

### **Outlook Configuration**
```json
{
  "name": "Outlook Account",
  "email": "your-email@outlook.com",
  "smtpHost": "smtp-mail.outlook.com",
  "smtpPort": 587,
  "smtpUsername": "your-email@outlook.com",
  "smtpPassword": "your-password",
  "smtpSecurity": "tls",
  "isActive": true
}
```

## 🔍 **Step 6: Database Verification**

### **Check Email Accounts**
```sql
SELECT * FROM email_accounts WHERE isActive = true;
```

### **Check Conference Templates**
```sql
SELECT c.name, c.initialTemplateId, et.name as templateName 
FROM conferences c 
LEFT JOIN email_templates et ON c.initialTemplateId = et.id;
```

### **Check Recent Clients**
```sql
SELECT firstName, lastName, email, conferenceId, createdAt 
FROM clients 
ORDER BY createdAt DESC 
LIMIT 5;
```

## 🔍 **Step 7: Manual Testing**

### **1. Create Test Data**
```bash
# Create a test client
curl -X POST "http://localhost:5000/api/clients" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Test",
    "lastName": "User",
    "email": "test@example.com",
    "conferenceId": "your-conference-id"
  }'
```

### **2. Check Campaign Creation**
```bash
# Check if campaign was created
curl -X GET "http://localhost:5000/api/campaigns" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### **3. Check Email Logs**
```bash
# Check email logs
curl -X GET "http://localhost:5000/api/emails" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 🔍 **Step 8: Server Console Debugging**

Add these debug logs to your server console:

```javascript
// In your client creation endpoint
console.log('🔍 Client creation debug:');
console.log('  - Client ID:', client.id);
console.log('  - Conference ID:', client.conferenceId);
console.log('  - Email:', client.email);

// In your automatic email function
console.log('🔍 Automatic email debug:');
console.log('  - Conference found:', !!conference);
console.log('  - Initial template:', !!conference?.initialTemplate);
console.log('  - SMTP account:', !!smtpAccount);
console.log('  - EmailService running:', emailService.isRunning);
```

## 🔍 **Step 9: Environment Variables**

Make sure these environment variables are set:

```bash
# .env file
JWT_SECRET=your-secret-key
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your-password
DB_NAME=crm_database
FRONTEND_URL=http://localhost:3000
```

## 🔍 **Step 10: Network Issues**

### **Check Port Access**
```bash
# Test if server is accessible
curl -X GET "http://localhost:5000/api/health"
```

### **Check Database Connection**
```bash
# Test database connection
curl -X GET "http://localhost:5000/api/conferences" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## ✅ **Quick Fix Checklist**

1. ✅ **Server is running** on port 5000
2. ✅ **Database is initialized** and connected
3. ✅ **SMTP account exists** and is active
4. ✅ **Conference has initial template** mapped
5. ✅ **Template exists** and is valid
6. ✅ **Client is assigned** to conference
7. ✅ **Server logs show** email sending process
8. ✅ **Email account credentials** are correct
9. ✅ **Network connectivity** is working
10. ✅ **No firewall blocking** SMTP ports

## 🚀 **Expected Flow**

When everything is working correctly:

1. **Add Client** → Conference assignment
2. **Server Logs** → Show automatic email process
3. **Email Sent** → Check inbox for automatic email
4. **Campaign Created** → Visible in campaign dashboard
5. **Follow-up Jobs** → Stage 1 and Stage 2 scheduled

## 📞 **Still Not Working?**

If emails are still not sending after following this guide:

1. **Check server console** for specific error messages
2. **Verify SMTP credentials** with your email provider
3. **Test SMTP connection** manually
4. **Check email provider** for blocking issues
5. **Review firewall settings** for SMTP ports

The most common issue is **SMTP account configuration** - make sure your SMTP account is properly set up and active! 🔧
