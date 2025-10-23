# 📧 Client Email Flow - Complete Guide

## 🚨 **Issue: Emails Not Sending When Adding Clients**

The automatic email system is working, but it requires **conference assignment** to trigger emails.

## 🔍 **Why Emails Aren't Sending:**

The automatic email is only sent when:
1. ✅ Client is created
2. ❌ **Conference is selected** (this is the missing step!)
3. ✅ Conference has initial template mapped
4. ✅ Active SMTP account exists

## 🚀 **Complete Solution:**

### **Step 1: Create Conference with Templates**

1. **Go to Conferences** → **Create Conference**
2. **Fill in basic details:**
   - Conference Name: "Tech Conference 2024"
   - Venue: "Convention Center"
   - Start Date: Select a date
   - End Date: Select a date

3. **Map Email Templates:**
   - **Initial Invitation Template**: Select from dropdown
   - **Stage 1 Template**: Select for Abstract Submission
   - **Stage 2 Template**: Select for Registration

4. **Save the conference**

### **Step 2: Create Client with Conference Assignment**

1. **Go to Clients** → **Add New Client**
2. **Fill in client details:**
   - First Name: "John"
   - Last Name: "Doe"
   - Email: "john@example.com"
   - Phone: "1234567890"
   - Country: "USA"
   - Organization: "Tech Corp"
   - Position: "Developer"

3. **IMPORTANT: Select Conference**
   - In the **Conference** dropdown, select "Tech Conference 2024"
   - This is the key step that triggers automatic emails!

4. **Save the client**

### **Step 3: Automatic Email Flow**

When you save the client with a conference assignment, the system will:

```
🚀 Starting automatic email for client: john@example.com, conference: [conference-id]
📧 Conference found: Tech Conference 2024
📧 Initial template found: [template-name]
📧 SMTP account found: [smtp-account-name]
🔧 Initializing EmailService...
✅ EmailService initialized
🔧 Setting up SMTP connection...
✅ SMTP connection established
🔧 Rendering email template...
📧 Rendered email subject: [email-subject]
🔧 Creating campaign for tracking...
📧 Campaign created: [campaign-id]
📤 Sending email...
✅ Automatic initial email sent to john@example.com for conference Tech Conference 2024
📧 Email ID: [email-id]
📅 Stage 1 email scheduled for [date]
📅 Stage 2 email scheduled for [date]
```

## 🧪 **Testing the Flow:**

### **Method 1: Manual Test**
1. Create a conference with initial template
2. Create a client and assign to conference
3. Check server logs for email sending messages
4. Check client's email inbox

### **Method 2: Debug Endpoint**
```bash
# Check system status
curl -X POST "http://localhost:5000/api/debug-email"
```

Response should show:
```json
{
  "smtpAccounts": 1,
  "conferences": 1,
  "initialTemplates": 1
}
```

### **Method 3: Test Automatic Email**
```bash
# Test automatic email for specific client
curl -X POST "http://localhost:5000/api/test-automatic-email" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"clientId": "client-id", "conferenceId": "conference-id"}'
```

## 📊 **Check Your Setup:**

### **1. Verify Conferences Have Templates**
```sql
SELECT c.name, et.name as template_name, et.stage 
FROM conferences c 
LEFT JOIN email_templates et ON c.initialTemplateId = et.id;
```

### **2. Verify SMTP Accounts**
```sql
SELECT name, email, isActive, type 
FROM email_accounts 
WHERE isActive = 1 AND type IN ('smtp', 'both');
```

### **3. Check Client Conference Assignment**
```sql
SELECT firstName, lastName, email, conferenceId 
FROM clients 
WHERE conferenceId IS NOT NULL;
```

## 🔧 **Troubleshooting:**

### **If No Emails Are Sent:**

1. **Check Conference Assignment:**
   - Ensure client has `conferenceId` set
   - Verify conference exists and is active

2. **Check Template Mapping:**
   - Ensure conference has `initialTemplateId` set
   - Verify template exists and is active

3. **Check SMTP Account:**
   - Ensure SMTP account is active
   - Verify SMTP credentials are correct

4. **Check Server Logs:**
   - Look for `🚀 Starting automatic email` messages
   - Check for error messages in console

### **Common Issues:**

**Issue 1: "No initial template mapped"**
```
❌ No initial template mapped for conference: [conference-name]
```
**Solution:** Map an initial template to the conference

**Issue 2: "No active SMTP account found"**
```
❌ No active SMTP account found for automatic email
```
**Solution:** Create and activate an SMTP account

**Issue 3: "SMTP connection failed"**
```
❌ SMTP connection failed: [error]
```
**Solution:** Check SMTP credentials and settings

## 📋 **Quick Checklist:**

- [ ] Conference created with initial template mapped
- [ ] SMTP account created and active
- [ ] Client created with conference assignment
- [ ] Server logs show email sending process
- [ ] Email received in client's inbox

## 🎯 **Expected Behavior:**

### **When Client is Created WITHOUT Conference:**
- ✅ Client is saved successfully
- ❌ No automatic email sent
- ℹ️ This is normal behavior

### **When Client is Created WITH Conference:**
- ✅ Client is saved successfully
- ✅ Automatic email sent immediately
- ✅ Campaign created for tracking
- ✅ Stage 1 and Stage 2 emails scheduled

## 💡 **Pro Tips:**

1. **Always assign clients to conferences** for automatic emails
2. **Map templates to conferences** before creating clients
3. **Check server logs** to see the email sending process
4. **Use the debug endpoint** to verify system status
5. **Test with a real email address** to verify delivery

## 🚀 **Result:**

Once you follow these steps, the automatic email system will work perfectly:

- ✅ **Initial Invitation** sent immediately when client is added
- ✅ **Stage 1 Email** scheduled for 7 days later
- ✅ **Stage 2 Email** scheduled for 14 days later
- ✅ **Campaign tracking** for all emails
- ✅ **Full email history** maintained

**The key is: Always assign clients to conferences with mapped templates!** 🎯
