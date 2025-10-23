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
const ImapService = require('./services/ImapService');
const FollowUpService = require('./services/FollowUpService');
const { initDatabase } = require('./database/init');
const { seedEnhancedData } = require('./database/enhancedSeed');
const { User, Role, Conference, Client, Email, EmailTemplate, FollowUpJob, EmailLog, EmailAccount, EmailFolder, EmailThread, Campaign } = require('./models');
const EmailService = require('./services/EmailService');
const emailRoutes = require('./routes/emailRoutes');
const emailAccountRoutes = require('./routes/emailAccountRoutes');
const campaignRoutes = require('./routes/campaignRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const { requireRole, requireConferenceAccess, requireUserManagement, requireClientAccess } = require('./middleware/rbac');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Initialize services
const imapService = new ImapService();
const followUpService = new FollowUpService();
const emailService = new EmailService();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize MySQL database with ORM
let dbInitialized = false;

async function initializeDatabase() {
  try {
    await initDatabase();
    await seedEnhancedData();
    dbInitialized = true;
    console.log('✅ Database initialization completed');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    console.log('🔄 Falling back to in-memory database...');
    dbInitialized = false;
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

// Role-based access control is imported from middleware

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    database: dbInitialized ? 'connected' : 'disconnected'
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

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.isActive) {
      return res.status(401).json({ error: 'Account is deactivated' });
    }

    // Update last login
    await user.update({ lastLogin: new Date() });

    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        name: user.name, 
        role: user.role 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        lastLogin: user.lastLogin
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    if (!dbInitialized) {
      return res.status(503).json({ error: 'Database not initialized' });
    }

    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Users routes
app.get('/api/users', authenticateToken, requireRole(['CEO', 'Manager']), async (req, res) => {
  try {
    if (!dbInitialized) {
      return res.status(503).json({ error: 'Database not initialized' });
    }

    const users = await User.findAll({
      attributes: { exclude: ['password'] },
      order: [['createdAt', 'DESC']]
    });

    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Conferences routes
app.get('/api/conferences', authenticateToken, async (req, res) => {
  try {
    if (!dbInitialized) {
      return res.status(503).json({ error: 'Database not initialized' });
    }

    const conferences = await Conference.findAll({
      include: [
        { model: User, as: 'primaryContact', attributes: ['id', 'name', 'email'] }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json(conferences);
  } catch (error) {
    console.error('Get conferences error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Clients routes
app.get('/api/clients', authenticateToken, async (req, res) => {
  try {
    if (!dbInitialized) {
      return res.status(503).json({ error: 'Database not initialized' });
    }

    const { conference_id, status, search, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = {};
    if (conference_id) whereClause.conferenceId = conference_id;
    if (status) whereClause.status = status;

    // Role-based filtering
    if (req.user.role === 'Agent') {
      whereClause.ownerUserId = req.user.id;
    }

    const { count, rows: clients } = await Client.findAndCountAll({
      where: whereClause,
      include: [
        { model: Conference, as: 'conference', attributes: ['id', 'name', 'venue'] },
        { model: User, as: 'owner', attributes: ['id', 'name', 'email'] }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    // Search functionality
    let filteredClients = clients;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredClients = clients.filter(client => 
        (client.name && client.name.toLowerCase().includes(searchLower)) ||
        (client.email && client.email.toLowerCase().includes(searchLower)) ||
        (client.company && client.company.toLowerCase().includes(searchLower))
      );
    }

    res.json({
      clients: filteredClients,
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / limit)
    });
  } catch (error) {
    console.error('Get clients error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/clients', authenticateToken, async (req, res) => {
  try {
    if (!dbInitialized) {
      return res.status(503).json({ error: 'Database not initialized' });
    }

    const {
      name,
      email,
      phone,
      country,
      company,
      position,
      source = 'Website',
      conferenceId,
      notes
    } = req.body;

    // Validate required fields
    if (!name || !email || !conferenceId) {
      return res.status(400).json({ error: 'Name, email, and conference are required' });
    }

    // Check if client already exists
    const existingClient = await Client.findOne({
      where: { email, conferenceId }
    });

    if (existingClient) {
      return res.status(400).json({ error: 'Client already exists for this conference' });
    }

    const client = await Client.create({
      name,
      email,
      phone,
      country,
      company,
      position,
      source,
      conferenceId,
      ownerUserId: req.user.id,
      notes,
      status: 'Lead'
    });

    // Create follow-up job for new client
    await FollowUpJob.create({
      clientId: client.id,
      stage: 'abstract_submission',
      followUpCount: 0,
      maxFollowUps: 3,
      nextSendAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day from now
      status: 'active',
      createdBy: req.user.id
    });

    const newClient = await Client.findByPk(client.id, {
      include: [
        { model: Conference, as: 'conference', attributes: ['id', 'name', 'venue'] },
        { model: User, as: 'owner', attributes: ['id', 'name', 'email'] }
      ]
    });

    res.status(201).json(newClient);
  } catch (error) {
    console.error('Create client error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Email Templates routes
app.get('/api/templates', authenticateToken, async (req, res) => {
  try {
    if (!dbInitialized) {
      return res.status(503).json({ error: 'Database not initialized' });
    }

    const templates = await EmailTemplate.findAll({
      where: { isActive: true },
      include: [
        { model: User, as: 'creator', attributes: ['id', 'name', 'email'] }
      ],
      order: [['stage', 'ASC'], ['followUpNumber', 'ASC']]
    });

    res.json(templates);
  } catch (error) {
    console.error('Get templates error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Follow-up jobs routes
app.get('/api/followup/jobs', authenticateToken, async (req, res) => {
  try {
    if (!dbInitialized) {
      return res.status(503).json({ error: 'Database not initialized' });
    }

    let whereClause = {};
    if (req.user.role === 'Agent') {
      whereClause.ownerUserId = req.user.id;
    }

    const jobs = await FollowUpJob.findAll({
      where: whereClause,
      include: [
        { model: Client, as: 'client', attributes: ['id', 'name', 'email', 'status'] },
        { model: User, as: 'creator', attributes: ['id', 'name', 'email'] }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json(jobs);
  } catch (error) {
    console.error('Get follow-up jobs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/followup/jobs', authenticateToken, async (req, res) => {
  try {
    if (!dbInitialized) {
      return res.status(503).json({ error: 'Database not initialized' });
    }

    const {
      clientId,
      stage,
      maxFollowUps = 3,
      customInterval,
      skipWeekends = true
    } = req.body;

    if (!clientId || !stage) {
      return res.status(400).json({ error: 'Client ID and stage are required' });
    }

    const job = await FollowUpJob.create({
      clientId,
      stage,
      maxFollowUps,
      customInterval,
      skipWeekends,
      nextSendAt: new Date(Date.now() + (customInterval || 1) * 24 * 60 * 60 * 1000),
      status: 'active',
      createdBy: req.user.id
    });

    res.status(201).json(job);
  } catch (error) {
    console.error('Create follow-up job error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/followup/jobs/:id/pause', authenticateToken, async (req, res) => {
  try {
    if (!dbInitialized) {
      return res.status(503).json({ error: 'Database not initialized' });
    }

    const job = await FollowUpJob.findByPk(req.params.id);
    if (!job) {
      return res.status(404).json({ error: 'Follow-up job not found' });
    }

    await job.update({ status: 'paused', paused: true });
    res.json(job);
  } catch (error) {
    console.error('Pause follow-up job error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/followup/jobs/:id/resume', authenticateToken, async (req, res) => {
  try {
    if (!dbInitialized) {
      return res.status(503).json({ error: 'Database not initialized' });
    }

    const job = await FollowUpJob.findByPk(req.params.id);
    if (!job) {
      return res.status(404).json({ error: 'Follow-up job not found' });
    }

    await job.update({ status: 'active', paused: false });
    res.json(job);
  } catch (error) {
    console.error('Resume follow-up job error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/followup/jobs/:id/stop', authenticateToken, async (req, res) => {
  try {
    if (!dbInitialized) {
      return res.status(503).json({ error: 'Database not initialized' });
    }

    const job = await FollowUpJob.findByPk(req.params.id);
    if (!job) {
      return res.status(404).json({ error: 'Follow-up job not found' });
    }

    await job.update({ status: 'stopped' });
    res.json(job);
  } catch (error) {
    console.error('Stop follow-up job error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/followup/stats', authenticateToken, async (req, res) => {
  try {
    if (!dbInitialized) {
      return res.status(503).json({ error: 'Database not initialized' });
    }

    const stats = await followUpService.getStatistics();
    res.json(stats);
  } catch (error) {
    console.error('Get follow-up stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Email API routes
app.use('/api/emails', authenticateToken, emailRoutes);
app.use('/api/email-accounts', authenticateToken, emailAccountRoutes);

// Campaign routes
app.use('/api/campaigns', authenticateToken, campaignRoutes);

// Dashboard routes
app.use('/api/dashboard', authenticateToken, dashboardRoutes);

// SMTP Accounts API (for backward compatibility with existing frontend)
app.get('/api/smtp-accounts', authenticateToken, async (req, res) => {
  try {
    if (!dbInitialized) {
      return res.status(503).json({ error: 'Database not initialized' });
    }

    const accounts = await EmailAccount.findAll({
      where: { type: ['smtp', 'both'] },
      include: [
        { model: User, as: 'creator', attributes: ['id', 'name', 'email'] }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json(accounts);
  } catch (error) {
    console.error('Get SMTP accounts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/smtp-accounts', authenticateToken, async (req, res) => {
  try {
    if (!dbInitialized) {
      return res.status(503).json({ error: 'Database not initialized' });
    }

    const {
      name,
      email,
      smtpHost,
      smtpPort = 587,
      smtpUsername,
      smtpPassword,
      smtpSecure = true,
      smtpAuth = true,
      isSystemAccount = false,
      allowUsers = true,
      createdBy = req.user.id
    } = req.body;

    // Validate required fields
    if (!name || !email || !smtpHost || !smtpUsername || !smtpPassword) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if account already exists
    const existingAccount = await EmailAccount.findOne({
      where: { email }
    });

    if (existingAccount) {
      return res.status(400).json({ error: 'Email account already exists' });
    }

    const account = await EmailAccount.create({
      name,
      email,
      type: 'smtp',
      smtpHost,
      smtpPort,
      smtpUsername,
      smtpPassword,
      smtpSecure,
      smtpAuth,
      isDefault: isSystemAccount,
      createdBy,
      syncStatus: 'disconnected'
    });

    res.status(201).json(account);
  } catch (error) {
    console.error('Create SMTP account error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/smtp-accounts/:id', authenticateToken, async (req, res) => {
  try {
    if (!dbInitialized) {
      return res.status(503).json({ error: 'Database not initialized' });
    }

    const account = await EmailAccount.findByPk(req.params.id);
    if (!account) {
      return res.status(404).json({ error: 'SMTP account not found' });
    }

    const updatedAccount = await account.update(req.body);
    res.json(updatedAccount);
  } catch (error) {
    console.error('Update SMTP account error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/smtp-accounts/:id', authenticateToken, async (req, res) => {
  try {
    if (!dbInitialized) {
      return res.status(503).json({ error: 'Database not initialized' });
    }

    const account = await EmailAccount.findByPk(req.params.id);
    if (!account) {
      return res.status(404).json({ error: 'SMTP account not found' });
    }

    await account.destroy();
    res.json({ success: true, message: 'SMTP account deleted' });
  } catch (error) {
    console.error('Delete SMTP account error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// IMAP Settings API (for backward compatibility with existing frontend)
app.get('/api/imap-settings', authenticateToken, async (req, res) => {
  try {
    if (!dbInitialized) {
      return res.status(503).json({ error: 'Database not initialized' });
    }

    const settings = await EmailAccount.findAll({
      where: { type: ['imap', 'both'] },
      include: [
        { model: User, as: 'creator', attributes: ['id', 'name', 'email'] }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json(settings);
  } catch (error) {
    console.error('Get IMAP settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/imap-settings', authenticateToken, async (req, res) => {
  try {
    if (!dbInitialized) {
      return res.status(503).json({ error: 'Database not initialized' });
    }

    const {
      name,
      email,
      imapHost,
      imapPort = 993,
      imapUsername,
      imapPassword,
      imapSecure = true,
      imapFolder = 'INBOX',
      createdBy = req.user.id
    } = req.body;

    // Validate required fields
    if (!name || !email || !imapHost || !imapUsername || !imapPassword) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if account already exists
    const existingAccount = await EmailAccount.findOne({
      where: { email }
    });

    if (existingAccount) {
      // Update existing account to include IMAP settings
      const updatedAccount = await existingAccount.update({
        type: existingAccount.type === 'smtp' ? 'both' : 'imap',
        imapHost,
        imapPort,
        imapUsername,
        imapPassword,
        imapSecure
      });
      return res.json(updatedAccount);
    }

    const account = await EmailAccount.create({
      name,
      email,
      type: 'imap',
      imapHost,
      imapPort,
      imapUsername,
      imapPassword,
      imapSecure,
      createdBy,
      syncStatus: 'disconnected'
    });

    res.status(201).json(account);
  } catch (error) {
    console.error('Create IMAP settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/imap-settings/:id', authenticateToken, async (req, res) => {
  try {
    if (!dbInitialized) {
      return res.status(503).json({ error: 'Database not initialized' });
    }

    const account = await EmailAccount.findByPk(req.params.id);
    if (!account) {
      return res.status(404).json({ error: 'IMAP settings not found' });
    }

    const updatedAccount = await account.update(req.body);
    res.json(updatedAccount);
  } catch (error) {
    console.error('Update IMAP settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/imap-settings/:id', authenticateToken, async (req, res) => {
  try {
    if (!dbInitialized) {
      return res.status(503).json({ error: 'Database not initialized' });
    }

    const account = await EmailAccount.findByPk(req.params.id);
    if (!account) {
      return res.status(404).json({ error: 'IMAP settings not found' });
    }

    await account.destroy();
    res.json({ success: true, message: 'IMAP settings deleted' });
  } catch (error) {
    console.error('Delete IMAP settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Graceful shutdown handling
process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');
  await imapService.cleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nShutting down gracefully...');
  await imapService.cleanup();
  process.exit(0);
});

// Initialize database and start server
async function startServer() {
  try {
    console.log('🔧 Initializing database...');
    await initializeDatabase();
    console.log('✅ Database connected and synced');
    
    // Start the server
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log('👥 Available users:');
      console.log('   CEO: admin@crm.com / admin123');
      console.log('   Manager: manager@crm.com / manager123');
      console.log('   Agent: agent@crm.com / agent123');
      console.log('\n📧 IMAP Service: Enhanced inbound email processing enabled');
      console.log('🗄️  Database: MySQL (crmdb)');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();
