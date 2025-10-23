const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const cron = require('node-cron');
const { v4: uuidv4 } = require('uuid');
const Joi = require('joi');
const http = require('http');
const socketIo = require('socket.io');
const ImapService = require('./services/ImapService');
const FollowUpService = require('./services/FollowUpService');
const RealTimeImapService = require('./services/RealTimeImapService');
const { initDatabase } = require('./database/init');
const { seedCleanData } = require('./database/cleanSeed');
const { Organization, User, Role, Conference, Client, Email, EmailTemplate, FollowUpJob, EmailLog, EmailAccount, EmailFolder, EmailThread, sequelize } = require('./models');
const { Op } = require('sequelize');
const EmailService = require('./services/EmailService');
const emailRoutes = require('./routes/emailRoutes');
const emailAccountRoutes = require('./routes/emailAccountRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const userRoutes = require('./routes/userRoutes');
const { requireRole, requireConferenceAccess, requireUserManagement, requireClientAccess } = require('./middleware/rbac');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const EMAIL_TEST_MODE = process.env.EMAIL_TEST_MODE !== 'false';

// Enhanced CORS configuration
const corsOptions = {
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

// Initialize services
const imapService = new ImapService();
const followUpService = new FollowUpService();
const emailService = new EmailService();

// Create HTTP server and WebSocket
const server = http.createServer(app);
const io = socketIo(server, {
  cors: corsOptions
});

// Middleware
app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Database initialization flag
let dbInitialized = false;

// Initialize database
async function initializeDatabase() {
  try {
    console.log('🔧 Initializing database...');
    
    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connection established');
    
    // Sync database (create tables if they don't exist)
    await sequelize.sync({ force: false, alter: false });
    console.log('✅ Database synchronized');
    
    // Check if we have users, if not seed the database
    const userCount = await User.count();
    if (userCount === 0) {
      console.log('🌱 Seeding database with initial data...');
      await seedCleanData();
      console.log('✅ Database seeded successfully');
    } else {
      console.log('📊 Database already has data, skipping seed');
    }
    
    dbInitialized = true;
    console.log('✅ Database initialization completed');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    dbInitialized = false;
    throw error;
  }
}

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    database: dbInitialized ? 'connected' : 'disconnected',
    emailTestMode: EMAIL_TEST_MODE
  });
});

// Authentication routes
app.post('/api/auth/login', async (req, res) => {
  try {
    if (!dbInitialized) {
      return res.status(503).json({ error: 'Database not initialized' });
    }

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user in database
    const user = await User.findOne({ 
      where: { email: email.toLowerCase() },
      include: [{ model: Role, as: 'role' }]
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        role: user.role?.name || 'Member',
        firstName: user.firstName,
        lastName: user.lastName
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role?.name || 'Member'
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    if (!dbInitialized) {
      return res.status(503).json({ error: 'Database not initialized' });
    }

    const user = await User.findByPk(req.user.id, {
      include: [{ model: Role, as: 'role' }]
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role?.name || 'Member'
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Password reset routes
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    if (!dbInitialized) {
      return res.status(503).json({ error: 'Database not initialized' });
    }

    const { email } = req.body;
    const user = await User.findOne({ where: { email: email.toLowerCase() } });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate reset token
    const resetToken = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '1h' });
    
    // In a real app, you'd send this via email
    res.json({ 
      message: 'Password reset token generated',
      resetToken: resetToken // For testing purposes
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    if (!dbInitialized) {
      return res.status(503).json({ error: 'Database not initialized' });
    }

    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findByPk(decoded.userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await user.update({ password: hashedPassword });

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Register routes
app.use('/api/emails', emailRoutes);
app.use('/api/email-accounts', emailAccountRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/users', userRoutes);

// Get clients for email compose
app.get('/api/clients/for-email', authenticateToken, async (req, res) => {
  try {
    if (!dbInitialized) {
      return res.status(503).json({ error: 'Database not initialized' });
    }

    let clients;
    
    if (req.user.role === 'CEO') {
      clients = await Client.findAll({
        attributes: ['id', 'firstName', 'lastName', 'email', 'organizationName'],
        limit: 100
      });
    } else if (req.user.role === 'TeamLead') {
      clients = await Client.findAll({
        where: { ownerUserId: req.user.id },
        attributes: ['id', 'firstName', 'lastName', 'email', 'organizationName'],
        limit: 100
      });
    } else {
      clients = await Client.findAll({
        where: { ownerUserId: req.user.id },
        attributes: ['id', 'firstName', 'lastName', 'email', 'organizationName'],
        limit: 50
      });
    }

    res.json(clients);
  } catch (error) {
    console.error('Get clients for email error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Direct email sending function
async function sendDirectEmail(client, emailType, conferenceName = 'Conference') {
  try {
    console.log(`📧 Sending ${emailType} email to ${client.email}`);
    
    if (EMAIL_TEST_MODE) {
      console.log(`🧪 TEST MODE: Email would be sent to ${client.email}`);
      console.log(`📧 Subject: ${emailType} for ${conferenceName}`);
      return { success: true, message: 'Email sent (test mode)' };
    }

    // Get active SMTP account
    const smtpAccount = await EmailAccount.findOne({ 
      where: { isActive: true, type: { [Op.in]: ['smtp', 'both'] } }
    });

    if (!smtpAccount) {
      console.log('⚠️ No active SMTP account found, skipping email');
      return { success: false, message: 'No SMTP account configured' };
    }

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: smtpAccount.smtpHost,
      port: smtpAccount.smtpPort,
      secure: smtpAccount.smtpPort === 465,
      auth: {
        user: smtpAccount.username,
        pass: smtpAccount.password
      }
    });

    // Email content based on type
    let subject, htmlContent, textContent;
    
    switch (emailType) {
      case 'initial_invitation':
        subject = `Welcome to ${conferenceName}!`;
        htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2c3e50;">Welcome to ${conferenceName}!</h2>
            <p>Dear ${client.firstName},</p>
            <p>We are excited to invite you to participate in <strong>${conferenceName}</strong>!</p>
            <p>We look forward to your participation!</p>
            <p>Best regards,<br>Conference Team</p>
          </div>
        `;
        textContent = `Welcome to ${conferenceName}!\n\nDear ${client.firstName},\n\nWe are excited to invite you to participate in ${conferenceName}!\n\nWe look forward to your participation!\n\nBest regards,\nConference Team`;
        break;
        
      case 'abstract_submission':
        subject = `Abstract Submission Reminder - ${conferenceName}`;
        htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #e74c3c;">Abstract Submission Reminder</h2>
            <p>Dear ${client.firstName},</p>
            <p>This is a friendly reminder about the abstract submission for <strong>${conferenceName}</strong>.</p>
            <p>Please submit your abstract to confirm your participation.</p>
            <p>Best regards,<br>Conference Team</p>
          </div>
        `;
        textContent = `Abstract Submission Reminder\n\nDear ${client.firstName},\n\nThis is a friendly reminder about the abstract submission for ${conferenceName}.\n\nPlease submit your abstract to confirm your participation.\n\nBest regards,\nConference Team`;
        break;
        
      case 'registration_reminder':
        subject = `Registration Reminder - ${conferenceName}`;
        htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #e74c3c;">Registration Reminder</h2>
            <p>Dear ${client.firstName},</p>
            <p>Thank you for your interest in <strong>${conferenceName}</strong>!</p>
            <p>We noticed you haven't completed your registration yet. This is a final reminder to secure your spot.</p>
            <p>Please complete your registration to confirm your participation.</p>
            <p>Best regards,<br>Conference Team</p>
          </div>
        `;
        textContent = `Registration Reminder\n\nDear ${client.firstName},\n\nThank you for your interest in ${conferenceName}!\n\nWe noticed you haven't completed your registration yet. This is a final reminder to secure your spot.\n\nPlease complete your registration to confirm your participation.\n\nBest regards,\nConference Team`;
        break;
        
      default:
        subject = `Update from ${conferenceName}`;
        htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2c3e50;">Update from ${conferenceName}</h2>
            <p>Dear ${client.firstName},</p>
            <p>This is an update regarding your participation in <strong>${conferenceName}</strong>.</p>
            <p>Best regards,<br>Conference Team</p>
          </div>
        `;
        textContent = `Update from ${conferenceName}\n\nDear ${client.firstName},\n\nThis is an update regarding your participation in ${conferenceName}.\n\nBest regards,\nConference Team`;
    }

    // Send email
    const mailOptions = {
      from: smtpAccount.fromEmail || smtpAccount.email,
      to: client.email,
      subject: subject,
      text: textContent,
      html: htmlContent
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent successfully: ${info.messageId}`);

    // Log email
    await EmailLog.create({
      emailId: `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      action: 'sent',
      clientId: client.id,
      emailType: emailType,
      status: 'sent',
      sentAt: new Date(),
      subject: subject,
      recipient: client.email
    });

    return { success: true, message: 'Email sent successfully', messageId: info.messageId };
  } catch (error) {
    console.error('❌ Email sending failed:', error);
    
    // Log failed email
    await EmailLog.create({
      emailId: `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      action: 'failed',
      clientId: client.id,
      emailType: emailType,
      status: 'failed',
      error: error.message,
      subject: subject || 'Email',
      recipient: client.email
    });

    return { success: false, message: 'Email sending failed', error: error.message };
  }
}

// Start server
async function startServer() {
  try {
    console.log('🔧 Initializing database...');
    await initializeDatabase();
    console.log('✅ Database connected and synced');
    
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`👥 Available users:`);
      console.log(`   CEO: admin@crm.com / admin123`);
      console.log(`   Manager: manager@crm.com / manager123`);
      console.log(`   Agent: agent@crm.com / agent123`);
    });
  } catch (error) {
    console.error('❌ Server startup failed:', error);
    process.exit(1);
  }
}

startServer();
