# MySQL Database Setup Guide

## 🗄️ **Complete MySQL ORM Setup for Conference CRM**

### **Database Credentials**
- **Database Name**: `crmdb`
- **Username**: `root`
- **Password**: `root`
- **Host**: `localhost`
- **Port**: `3306`

### **1. Prerequisites**
Make sure you have MySQL installed and running on your system.

### **2. Create Database**
```sql
CREATE DATABASE crmdb;
```

### **3. Environment Variables**
Create a `.env` file in the `server` directory with:

```env
# Database Configuration
DB_NAME=crmdb
DB_USER=root
DB_PASSWORD=root
DB_HOST=localhost
DB_PORT=3306

# JWT Secret
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# IMAP Configuration
IMAP_HOST=imap.gmail.com
IMAP_PORT=993
IMAP_USER=your-email@gmail.com
IMAP_PASS=your-app-password

# Server Configuration
PORT=5000
NODE_ENV=development
```

### **4. Database Models Created**

#### **Users Table**
- `id` (Primary Key)
- `email` (Unique)
- `password` (Hashed)
- `name`
- `role` (CEO, Manager, Agent)
- `isActive`
- `lastLogin`
- `createdAt`, `updatedAt`

#### **Conferences Table**
- `id` (Primary Key)
- `name`
- `venue`
- `startDate`, `endDate`
- `primaryContactUserId` (Foreign Key)
- `currency`
- `abstractDeadline`, `registrationDeadline`
- `description`, `website`
- `isActive`
- `createdAt`, `updatedAt`

#### **Clients Table**
- `id` (Primary Key)
- `name`
- `email`
- `phone`, `country`
- `status` (Lead, Abstract Submitted, Registered, Unresponsive)
- `conferenceId` (Foreign Key)
- `ownerUserId` (Foreign Key)
- `notes`, `company`, `position`
- `source`, `lastContactDate`
- `isActive`
- `createdAt`, `updatedAt`

#### **Emails Table**
- `id` (Primary Key)
- `messageId` (Unique)
- `from`, `to`, `cc`, `bcc`
- `subject`, `body`, `bodyHtml`
- `folder` (inbox, sent, etc.)
- `isRead`, `isImportant`, `hasAttachments`
- `attachments` (JSON)
- `date`, `size`
- `clientId` (Foreign Key)
- `isSent`, `isDraft`
- `replyTo`, `inReplyTo`, `threadId`
- `createdAt`, `updatedAt`

#### **Email Templates Table**
- `id` (Primary Key)
- `name`
- `stage` (abstract_submission, registration)
- `followUpNumber`
- `subject`, `bodyHtml`, `bodyText`
- `isActive`
- `createdBy` (Foreign Key)
- `description`, `variables` (JSON)
- `sendAfterDays`
- `createdAt`, `updatedAt`

#### **Follow-up Jobs Table**
- `id` (Primary Key)
- `clientId` (Foreign Key)
- `stage` (abstract_submission, registration)
- `followUpCount`, `maxFollowUps`
- `nextSendAt`, `lastSentAt`
- `status` (active, paused, stopped)
- `paused`, `skipWeekends`
- `customInterval`
- `createdBy` (Foreign Key)
- `notes`, `completedAt`
- `createdAt`, `updatedAt`

#### **Email Logs Table**
- `id` (Primary Key)
- `emailId` (Foreign Key)
- `clientId` (Foreign Key)
- `action` (sent, delivered, opened, clicked, bounced, failed)
- `details` (JSON)
- `timestamp`
- `ipAddress`, `userAgent`
- `createdAt`, `updatedAt`

### **5. Relationships**
- **User** → **Conference** (One-to-Many)
- **Conference** → **Client** (One-to-Many)
- **Client** → **Email** (One-to-Many)
- **Client** → **FollowUpJob** (One-to-Many)
- **User** → **EmailTemplate** (One-to-Many)
- **User** → **FollowUpJob** (One-to-Many)
- **Email** → **EmailLog** (One-to-Many)

### **6. Features**
- ✅ **Persistent Data** - No more data loss on restart
- ✅ **ACID Compliance** - Reliable transactions
- ✅ **Scalability** - Handle large datasets
- ✅ **Relationships** - Proper foreign keys and joins
- ✅ **Migrations** - Easy schema updates
- ✅ **Query Optimization** - Efficient database queries
- ✅ **Data Integrity** - Constraints and validations

### **7. Running the Application**
```bash
# Install dependencies
cd server
npm install

# Start the server
npm start
```

The application will automatically:
1. Connect to MySQL database
2. Create all tables if they don't exist
3. Seed initial data (users, conference, email templates)
4. Start the server

### **8. Default Users Created**
- **CEO**: admin@crm.com / admin123
- **Manager**: manager@crm.com / manager123
- **Agent**: agent@crm.com / agent123

### **9. Troubleshooting**

#### **Connection Issues**
- Ensure MySQL is running
- Check credentials in `.env` file
- Verify database `crmdb` exists

#### **Permission Issues**
- Make sure MySQL user has proper permissions
- Grant all privileges: `GRANT ALL PRIVILEGES ON crmdb.* TO 'root'@'localhost';`

#### **Port Issues**
- Default MySQL port is 3306
- Check if port is available: `netstat -an | findstr 3306`

### **10. Benefits Over In-Memory Database**
- **Data Persistence** - Data survives server restarts
- **Concurrent Access** - Multiple users can access simultaneously
- **Data Integrity** - Foreign key constraints and validations
- **Scalability** - Can handle large amounts of data
- **Backup & Recovery** - Easy to backup and restore
- **Performance** - Optimized queries and indexing
- **Relationships** - Proper data relationships and joins

### **11. Next Steps**
1. Start MySQL service
2. Create `crmdb` database
3. Copy `.env.example` to `.env` and update credentials
4. Run the application
5. Access the admin dashboard at `http://localhost:3000`

**Your Conference CRM is now powered by MySQL! 🎉**
