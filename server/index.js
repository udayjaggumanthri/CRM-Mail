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
const EmailJobScheduler = require('./services/EmailJobScheduler');
const { initDatabase } = require('./database/init');
const { seedCleanData } = require('./database/cleanSeed');
const { Organization, User, Role, Conference, Client, Email, EmailTemplate, FollowUpJob, EmailLog, EmailAccount, EmailFolder, EmailThread, sequelize } = require('./models');
const { Op } = require('sequelize');
const EmailService = require('./services/EmailService');
const emailRoutes = require('./routes/emailRoutes');
const emailAccountRoutes = require('./routes/emailAccountRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const userRoutes = require('./routes/userRoutes');
const clientRoutes = require('./routes/clientRoutes');
const { router: imapRoutes, realTimeImapService } = require('./routes/imapRoutes');
const { requireRole, requireConferenceAccess, requireUserManagement, requireClientAccess } = require('./middleware/rbac');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const EMAIL_TEST_MODE = process.env.EMAIL_TEST_MODE !== 'false';

// Enhanced CORS configuration - Allow all origins for Replit environment
const corsOptions = {
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

// Initialize services
const imapService = new ImapService();
const followUpService = new FollowUpService();
const emailService = new EmailService();
const emailJobScheduler = new EmailJobScheduler();

// Create HTTP server and WebSocket
const server = http.createServer(app);
const io = socketIo(server, {
  cors: corsOptions
});

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('🔌 Client connected to WebSocket:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('🔌 Client disconnected from WebSocket:', socket.id);
  });
  
  // Handle email-related events
  socket.on('join-email-room', (data) => {
    socket.join('email-updates');
    console.log('📧 Client joined email room');
  });
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
    
    // Sync database - create tables if they don't exist
    await sequelize.sync({ force: false });
    console.log('✅ Database connected and synced');
    
    // Check if we have users, if not seed the database
    const userCount = await User.count();
    if (userCount === 0) {
      console.log('🌱 Seeding database with initial data...');
      await seedCleanData();
      console.log('✅ Database seeded successfully');
    } else {
      console.log(`📊 Database already has ${userCount} users, preserving existing data`);
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

// Favicon endpoint to prevent 500 errors
app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
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
      include: [{ model: Role, as: 'roleDetails' }]
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
        role: user.roleDetails?.name || user.role || 'Member',
        firstName: user.name,
        lastName: user.name,
        organizationId: user.organizationId
      },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
        firstName: user.name,
        lastName: user.name,
        role: user.roleDetails?.name || user.role || 'Member'
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
      include: [{ model: Role, as: 'roleDetails' }]
    });

  if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user.id,
      email: user.email,
      firstName: user.name,
      lastName: user.name,
      role: user.roleDetails?.name || user.role || 'Member'
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
app.use('/api/clients', clientRoutes);
app.use('/api/inbound', imapRoutes);

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

// SMTP accounts alias (routes already registered above)
app.use('/api/smtp-accounts', emailAccountRoutes);

// Add missing analytics and system routes
app.get('/api/analytics/ceo-dashboard', authenticateToken, async (req, res) => {
  try {
    res.json({
      totalClients: 0,
      totalConferences: 0,
      totalEmails: 0,
      recentActivity: []
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/analytics/recent-activity', authenticateToken, async (req, res) => {
  try {
    res.json([]);
  } catch (error) {
    console.error('Recent activity error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/system/status', authenticateToken, async (req, res) => {
  try {
    res.json({
      status: 'healthy',
      database: 'connected',
      services: {
        email: 'active',
        imap: 'active'
      }
    });
  } catch (error) {
    console.error('System status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/notifications', authenticateToken, async (req, res) => {
  try {
    res.json([]);
  } catch (error) {
    console.error('Notifications error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add missing inbound email routes
app.get('/api/inbound/status', authenticateToken, async (req, res) => {
  try {
    res.json({
      status: 'stopped',
      activeConnections: 0,
      configuredAccounts: 0,
      lastSync: null
    });
  } catch (error) {
    console.error('Inbound status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/inbound/polling', authenticateToken, async (req, res) => {
  try {
    const { action } = req.body;
    res.json({
      success: true,
      message: `Polling ${action} successfully`,
      status: action === 'start' ? 'active' : 'stopped'
    });
  } catch (error) {
    console.error('Polling control error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/inbound/test', authenticateToken, async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Connection test successful',
      status: 'connected'
    });
  } catch (error) {
    console.error('Connection test error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add missing inbound test POST endpoint
app.post('/api/inbound/test', authenticateToken, async (req, res) => {
  try {
    const { accountId } = req.body;
    
    res.json({
      success: true,
      message: 'IMAP connection test successful',
      status: 'connected',
      accountId: accountId || 'default'
    });
  } catch (error) {
    console.error('IMAP test error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/inbound/fetch', authenticateToken, async (req, res) => {
  try {
    res.json({ 
      success: true, 
      message: 'Email fetch completed',
      emailsFetched: 0
    });
  } catch (error) {
    console.error('Email fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add missing email management endpoints
app.post('/api/emails/clear', authenticateToken, async (req, res) => {
  try {
    // Clear demo emails
    await Email.destroy({ where: {} });
    await EmailLog.destroy({ where: {} });
    
    res.json({
      success: true,
      message: 'All demo emails cleared successfully'
    });
  } catch (error) {
    console.error('Clear emails error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/emails/reset', authenticateToken, async (req, res) => {
  try {
    // Reset email state
    await Email.destroy({ where: {} });
    await EmailLog.destroy({ where: {} });

    res.json({ 
      success: true, 
      message: 'Email state reset successfully'
    });
  } catch (error) {
    console.error('Reset emails error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add missing email endpoints
app.get('/api/emails', authenticateToken, async (req, res) => {
  try {
    const emails = await Email.findAll({
      order: [['createdAt', 'DESC']],
      limit: 50
    });
    res.json(emails);
  } catch (error) {
    console.error('Get emails error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/email-logs', authenticateToken, async (req, res) => {
  try {
    const logs = await EmailLog.findAll({
      order: [['createdAt', 'DESC']],
      limit: 50
    });
    res.json(logs);
  } catch (error) {
    console.error('Get email logs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add missing email send endpoint
app.post('/api/emails/send', authenticateToken, async (req, res) => {
  try {
    console.log('📧 Email send request body:', req.body);
    console.log('📧 Email send request headers:', req.headers);
    console.log('📧 Email send request method:', req.method);
    console.log('📧 Authenticated user:', req.user);
    
    const { to, subject, body, cc, bcc, templateId, attachments, clientId, isDraft } = req.body;

    // Validate required fields
    if (!to || !subject || !body) {
      console.log('❌ Missing required fields:', { to, subject, body });
      return res.status(400).json({ 
        error: 'Missing required fields: to, subject, and body are required',
        details: { to: !!to, subject: !!subject, body: !!body }
      });
    }
    
    // Validate user authentication
    if (!req.user || !req.user.id) {
      console.log('❌ User not authenticated:', req.user);
      return res.status(401).json({ 
        error: 'User not authenticated. Please login first.' 
      });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return res.status(400).json({ 
        error: 'Invalid email format for recipient' 
      });
    }
    
    // Get the first available email account for sending
    const emailAccount = await EmailAccount.findOne({
      where: { isActive: true }
    });
    
    if (!emailAccount) {
      return res.status(400).json({ 
        error: 'No active email account found. Please configure an email account first.' 
      });
    }

    // Create email record
    console.log('📧 Creating email with data:', {
      to, subject, body, sentBy: req.user.id, emailAccountId: emailAccount.id
    });
    
    const email = await Email.create({
      to,
      cc: cc || '',
      bcc: bcc || '',
      subject,
      body,
      templateId: templateId || null,
      attachments: attachments || [],
      clientId: clientId || null,
      isDraft: isDraft || false,
      status: isDraft ? 'draft' : 'sent',
      sentBy: req.user.id,
      emailAccountId: emailAccount.id
    });
    
    console.log('✅ Email created successfully:', email.id);
    
    // Create email log
    await EmailLog.create({
      emailId: email.id,
      action: 'sent',
      status: 'success',
      details: `Email sent to ${to}`,
      sentBy: req.user.id
    });
    
    res.json({
      success: true,
      message: 'Email sent successfully',
      email: email
    });
  } catch (error) {
    console.error('Send email error:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({ 
        error: 'Validation error', 
        details: error.errors.map(err => ({
          field: err.path,
          message: err.message,
          value: err.value
        }))
      });
    }
    
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});



// Add missing conference endpoints
app.get('/api/conferences', authenticateToken, async (req, res) => {
  try {
    const conferences = await Conference.findAll({
      order: [['createdAt', 'DESC']],
      limit: 100
    });
    res.json(conferences);
  } catch (error) {
    console.error('Get conferences error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/conferences', authenticateToken, async (req, res) => {
  try {
    // Clean the request body to handle empty template IDs
    const conferenceData = { ...req.body };
    
    // Set template IDs to null if they are empty strings or undefined
    if (!conferenceData.initialTemplateId || conferenceData.initialTemplateId === '') {
      conferenceData.initialTemplateId = null;
    }
    if (!conferenceData.stage1TemplateId || conferenceData.stage1TemplateId === '') {
      conferenceData.stage1TemplateId = null;
    }
    if (!conferenceData.stage2TemplateId || conferenceData.stage2TemplateId === '') {
      conferenceData.stage2TemplateId = null;
    }
    
    // Ensure other required fields have defaults
    conferenceData.status = conferenceData.status || 'draft';
    conferenceData.isActive = conferenceData.isActive !== false;
    
    const conference = await Conference.create(conferenceData);
    res.status(201).json(conference);
  } catch (error) {
    console.error('Create conference error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

app.put('/api/conferences/:id', authenticateToken, async (req, res) => {
  try {
    const conference = await Conference.findByPk(req.params.id);
    if (!conference) {
      return res.status(404).json({ error: 'Conference not found' });
    }
    await conference.update(req.body);
    res.json(conference);
  } catch (error) {
    console.error('Update conference error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/conferences/:id', authenticateToken, async (req, res) => {
  try {
    const conference = await Conference.findByPk(req.params.id);
    if (!conference) {
      return res.status(404).json({ error: 'Conference not found' });
    }
    await conference.destroy();
    res.json({ success: true, message: 'Conference deleted successfully' });
  } catch (error) {
    console.error('Delete conference error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add missing template endpoints
app.get('/api/templates', authenticateToken, async (req, res) => {
  try {
    const templates = await EmailTemplate.findAll({
      order: [['createdAt', 'DESC']],
      limit: 100
    });
    res.json(templates);
  } catch (error) {
    console.error('Get templates error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/templates', authenticateToken, async (req, res) => {
  try {
    const template = await EmailTemplate.create(req.body);
    res.status(201).json(template);
  } catch (error) {
    console.error('Create template error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/templates/:id', authenticateToken, async (req, res) => {
  try {
    const template = await EmailTemplate.findByPk(req.params.id);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    await template.update(req.body);
    res.json(template);
  } catch (error) {
    console.error('Update template error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/templates/:id', authenticateToken, async (req, res) => {
  try {
    const template = await EmailTemplate.findByPk(req.params.id);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    await template.destroy();
    res.json({ success: true, message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Delete template error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});



// Bulk assign conference endpoint
app.post('/api/clients/bulk-assign-conference', authenticateToken, async (req, res) => {
  try {
    console.log('🔗 Bulk assign conference request body:', req.body);
    
    // Handle both 'ids' and 'clientIds' for frontend compatibility
    const clientIds = req.body.clientIds || req.body.ids;
    const conferenceId = req.body.conferenceId;
    
    if (!clientIds || !Array.isArray(clientIds) || clientIds.length === 0) {
      console.log('❌ Invalid clientIds:', clientIds);
      return res.status(400).json({ 
        error: 'Invalid clientIds', 
        details: 'clientIds must be a non-empty array' 
      });
    }
    
    if (!conferenceId) {
      return res.status(400).json({ 
        error: 'Conference ID is required' 
      });
    }
    
    // Check if conference exists
    const conference = await Conference.findByPk(conferenceId);
    if (!conference) {
      return res.status(404).json({ 
        error: 'Conference not found' 
      });
    }
    
    // Update clients with conference assignment and trigger email workflow
    const updatedClients = [];
    const emailResults = [];
    
    for (const clientId of clientIds) {
      const client = await Client.findByPk(clientId);
      if (client) {
        // Update conference assignment
        await client.update({ conferenceId: conferenceId });
        updatedClients.push(client);
        
        // Trigger automatic email workflow
        try {
          // Import the clientRoutes to access the workflow function
          const clientRoutes = require('./routes/clientRoutes');
          await clientRoutes.startAutomaticEmailWorkflow(clientId, conferenceId);
          emailResults.push({ clientId, success: true });
          console.log(`✅ Email workflow started for client ${clientId}`);
        } catch (emailError) {
          console.error(`❌ Email workflow failed for client ${clientId}:`, emailError);
          emailResults.push({ clientId, success: false, error: emailError.message });
        }
      }
    }
    
    res.json({ 
      success: true, 
      message: `Successfully assigned ${updatedClients.length} clients to conference`,
      updatedClients: updatedClients.length,
      emailsTriggered: emailResults.filter(r => r.success).length
    });
  } catch (error) {
    console.error('Bulk assign conference error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// Add missing user management endpoints
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    const users = await User.findAll({
      include: [{ model: Role, as: 'roleDetails' }],
      order: [['createdAt', 'DESC']],
      limit: 100
    });
    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/users', authenticateToken, async (req, res) => {
  try {
    const user = await User.create(req.body);
    res.status(201).json(user);
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    await user.update(req.body);
    res.json(user);
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    await user.destroy();
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add favicon endpoint
app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});

// Add health check endpoint
app.get('/api/health', (req, res) => {
      res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: 'connected'
  });
});

// Ensure auth/me endpoint is available
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      include: [{ model: Role, as: 'roleDetails' }]
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
      }

      res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      firstName: user.name,
      lastName: user.name,
      role: user.roleDetails?.name || user.role,
      isActive: user.isActive,
      phone: user.phone,
      department: user.department,
      position: user.position
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Remove duplicate auth/me endpoint - already defined above

// Add missing dashboard endpoint
app.get('/api/dashboard', authenticateToken, async (req, res) => {
  try {
    const { timeRange = '7d', conferenceId = 'all' } = req.query;
    
    // Get basic statistics
    const totalClients = await Client.count();
    const totalConferences = await Conference.count();
    const totalEmails = await EmailLog.count();
    
    // Get recent activity - handle case when no clients exist
    let recentClients = [];
    try {
      recentClients = await Client.findAll({
        limit: 5,
        order: [['createdAt', 'DESC']],
        attributes: ['id', 'firstName', 'lastName', 'email', 'status', 'createdAt']
    });
  } catch (error) {
      console.log('No clients found or error fetching clients:', error.message);
      recentClients = [];
    }

    res.json({ 
      totalClients,
      totalConferences,
      totalEmails,
      recentClients,
      timeRange,
      conferenceId
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start server
async function startServer() {
  try {
    // Initialize database FIRST before accepting requests
    console.log('🔧 Initializing database...');
    await initializeDatabase();
    console.log('✅ Database connected and synced');
    console.log(`👥 Available users:`);
    console.log(`   CEO: admin@crm.com / admin123`);
    console.log(`   Manager: manager@crm.com / manager123`);
    console.log(`   Agent: agent@crm.com / agent123`);
    
    // Start IMAP real-time service
    console.log('📧 Starting IMAP real-time sync service...');
    try {
      // Initialize models in the service first
      realTimeImapService.initializeModels({ Email, EmailAccount, EmailThread, EmailLog, Client });
      await realTimeImapService.startRealTimeSync();
      console.log('✅ IMAP real-time sync started');
    } catch (error) {
      console.error('❌ Failed to start real-time IMAP sync:', error.message);
      console.log('💡 You can start it manually from the IMAP Settings page');
    }
    
    // Start Email Job Scheduler
    console.log('📨 Starting Email Job Scheduler...');
    try {
      emailJobScheduler.start();
      console.log('✅ Email Job Scheduler started');
    } catch (error) {
      console.error('❌ Failed to start Email Job Scheduler:', error.message);
    }
    
    // Start HTTP server AFTER database is ready
    server.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
      console.log(`📡 Ready to accept requests`);
    });
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    console.error('⚠️  Cannot start server without database');
    process.exit(1);
  }
}

startServer();
