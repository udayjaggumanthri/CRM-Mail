# 📧 IMAP Setup Guide for Conference CRM

## Quick Setup for Real Email Integration

### 🚀 **Step 1: Access IMAP Settings**
1. Open Conference CRM: `http://localhost:3000`
2. Login with: `admin@crm.com` / `admin123`
3. Go to **Settings** (gear icon in sidebar)
4. Click **"IMAP Settings"** tab

### 🔧 **Step 2: Configure Your Email Account**

#### **For Gmail Users:**
1. **Create App Password First:**
   - Go to [Google Account](https://myaccount.google.com/)
   - Security → 2-Step Verification (enable if needed)
   - Security → App passwords
   - Generate app password for "Mail"
   - Copy the 16-character password

2. **Configure in CRM:**
   - IMAP Host: `imap.gmail.com`
   - IMAP Port: `993`
   - Security: `SSL`
   - Username: `your-email@gmail.com`
   - Password: `your-16-character-app-password`
   - IMAP Folder: `INBOX`

#### **For Outlook/Hotmail Users:**
- IMAP Host: `outlook.office365.com`
- IMAP Port: `993`
- Security: `SSL`
- Username: `your-email@outlook.com`
- Password: `your-regular-password`
- IMAP Folder: `INBOX`

#### **For Yahoo Users:**
- IMAP Host: `imap.mail.yahoo.com`
- IMAP Port: `993`
- Security: `SSL`
- Username: `your-email@yahoo.com`
- Password: `app-password` (create in Yahoo settings)
- IMAP Folder: `INBOX`

### ✅ **Step 3: Test and Activate**

1. **Test Connection:**
   - Select your configured account
   - Click "Test Connection"
   - Should show "IMAP connection successful"

2. **Fetch Emails:**
   - Click "Fetch Emails"
   - Should show "Fetched X emails"

3. **Start Polling:**
   - Click "Start Polling"
   - Status should show "Active"

### 📱 **Step 4: View Your Emails**

1. Go to **Email Client** in the sidebar
2. You should now see your real emails in:
   - **Inbox**: Received emails
   - **Sent**: Sent emails (if configured)
   - **Drafts**: Draft emails
   - **Important**: Starred emails

### 🔍 **Troubleshooting**

#### **Connection Failed:**
- Check your email/password
- For Gmail: Use App Password, not regular password
- Check if 2FA is enabled
- Verify IMAP is enabled in your email settings

#### **No Emails Appearing:**
- Check IMAP folder setting (usually "INBOX")
- Try "Fetch Emails" manually
- Check if polling is started
- Look at browser console for errors

#### **Gmail Specific:**
- Enable IMAP in Gmail Settings → Forwarding and POP/IMAP
- Use App Password, not regular password
- Make sure 2-Step Verification is enabled

### 🎯 **Expected Results**

After successful setup:
- ✅ Real emails appear in Email Client
- ✅ Inbox shows received emails
- ✅ Sent folder shows sent emails
- ✅ Emails are automatically matched with clients
- ✅ New emails appear every 2 minutes automatically

### 📞 **Need Help?**

If you encounter issues:
1. Check the IMAP Settings status
2. Look at the connection status indicators
3. Try the "Test Connection" feature
4. Check browser console for error messages

---

**Your Conference CRM is now ready to handle real email integration!** 🎉
