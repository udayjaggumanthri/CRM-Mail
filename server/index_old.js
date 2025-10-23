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
const { User, Conference, Client, Email, EmailTemplate, FollowUpJob, EmailLog, EmailAccount, EmailFolder, EmailThread } = require('./models');
const EmailService = require('./services/EmailService');
const emailRoutes = require('./routes/emailRoutes');
const emailAccountRoutes = require('./routes/emailAccountRoutes');
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

// Database will be initialized using the new ORM setup

// Initialize MySQL database with ORM
let dbInitialized = false;

async function initializeDatabase() {
  try {
    await initDatabase();
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

// Role-based access control
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};

// Auth routes
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!dbInitialized) {
      return res.status(503).json({ error: 'Database not initialized' });
    }

    const user = await User.findOne({ where: { email, isActive: true } });
    
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

    // Update last login
    await user.update({ lastLogin: new Date() });

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
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

    const user = await User.findByPk(req.user.id);
    
  if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ 
      id: user.id, 
      email: user.email, 
      name: user.name, 
      role: user.role 
    });
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
      attributes: ['id', 'email', 'name', 'role', 'isActive', 'createdAt', 'lastLogin'],
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
      include: [{ model: User, as: 'primaryContact', attributes: ['id', 'name', 'email'] }],
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

    const whereClause = {};
    
    // Filter by role
    if (req.user.role === 'Agent') {
      whereClause.ownerUserId = req.user.id;
    }
    
    // Apply filters
    if (req.query.conference_id) {
      whereClause.conferenceId = req.query.conference_id;
    }
    if (req.query.status) {
      whereClause.status = req.query.status;
    }
    if (req.query.owner) {
      whereClause.ownerUserId = req.query.owner;
    }

    const clients = await Client.findAll({
      where: whereClause,
      include: [
        { model: Conference, as: 'conference', attributes: ['id', 'name', 'venue'] },
        { model: User, as: 'owner', attributes: ['id', 'name', 'email'] }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json(clients);
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

    const { firstName, lastName, email, country, phone, conferenceId, notes, company, position, source } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !email || !conferenceId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if email already exists
    const existingClient = await Client.findOne({ where: { email, conferenceId } });
    if (existingClient) {
      return res.status(400).json({ error: 'Client with this email already exists for this conference' });
    }

    const client = await Client.create({
      name: `${firstName} ${lastName}`,
      email,
      country,
      phone,
      status: 'Lead',
      conferenceId,
      ownerUserId: req.user.id,
      notes,
      company,
      position,
      source: source || 'Website',
      lastContactDate: new Date()
    });

    // Create follow-up job for Stage 1 (Abstract Submission)
    const followupJob = await FollowUpJob.create({
      clientId: client.id,
      stage: 'abstract_submission',
      followUpCount: 0,
      maxFollowUps: 6,
      nextSendAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      customInterval: 7,
      skipWeekends: true,
      status: 'active',
      paused: false,
      createdBy: req.user.id
    });

    // Fetch the created client with relationships
    const createdClient = await Client.findByPk(client.id, {
      include: [
        { model: Conference, as: 'conference', attributes: ['id', 'name', 'venue'] },
        { model: User, as: 'owner', attributes: ['id', 'name', 'email'] }
      ]
    });

    res.status(201).json(createdClient);
  } catch (error) {
    console.error('Create client error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/clients/:id', authenticateToken, (req, res) => {
  const clientId = req.params.id;
  const clientIndex = db.clients.findIndex(c => c.id === clientId);

  if (clientIndex === -1) {
    return res.status(404).json({ error: 'Client not found' });
  }

  // Check permissions
  if (req.user.role === 'Agent' && db.clients[clientIndex].ownerUserId !== req.user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const updatedClient = {
    ...db.clients[clientIndex],
    ...req.body,
    updatedAt: new Date()
  };

  db.clients[clientIndex] = updatedClient;
  res.json(updatedClient);
});

app.post('/api/clients/:id/submit-abstract', authenticateToken, (req, res) => {
  const clientId = req.params.id;
  const clientIndex = db.clients.findIndex(c => c.id === clientId);

  if (clientIndex === -1) {
    return res.status(404).json({ error: 'Client not found' });
  }

  // Update client status
  db.clients[clientIndex].status = 'Abstract Submitted';
  db.clients[clientIndex].updatedAt = new Date();

  // Stop Stage 1 follow-ups
  const stage1Jobs = db.followupJobs.filter(j => j.clientId === clientId && j.stage === 1);
  stage1Jobs.forEach(job => {
    job.status = 'completed';
  });

  // Create Stage 2 follow-up job
  const stage2Job = {
    id: uuidv4(),
    clientId: clientId,
    conferenceId: db.clients[clientIndex].conferenceId,
    stage: 2,
    nextSendAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
    intervalDays: 3,
    intervalSkipWeekends: true,
    maxAttempts: 6,
    attemptsDone: 0,
    paused: false,
    lastSentAt: null,
    status: 'active'
  };

  db.followupJobs.push(stage2Job);

  res.json(db.clients[clientIndex]);
});

app.post('/api/clients/:id/register', authenticateToken, (req, res) => {
  const clientId = req.params.id;
  const clientIndex = db.clients.findIndex(c => c.id === clientId);

  if (clientIndex === -1) {
    return res.status(404).json({ error: 'Client not found' });
  }

  // Update client status
  db.clients[clientIndex].status = 'Registered';
  db.clients[clientIndex].updatedAt = new Date();

  // Stop all follow-ups
  const activeJobs = db.followupJobs.filter(j => j.clientId === clientId && j.status === 'active');
  activeJobs.forEach(job => {
    job.status = 'completed';
  });

  res.json(db.clients[clientIndex]);
});

// Templates routes
app.get('/api/templates', authenticateToken, (req, res) => {
  res.json(db.templates);
});

app.post('/api/templates', authenticateToken, requireRole(['CEO', 'Manager']), (req, res) => {
  const { name, stage, subject, bodyHtml, bodyText } = req.body;

  const template = {
    id: uuidv4(),
    name,
    stage,
    subject,
    bodyHtml,
    bodyText,
    isActive: true,
    createdBy: req.user.id,
    createdAt: new Date(),
    version: 1
  };

  db.templates.push(template);
  res.status(201).json(template);
});

app.put('/api/templates/:id', authenticateToken, requireRole(['CEO', 'Manager']), (req, res) => {
  const templateId = req.params.id;
  const templateIndex = db.templates.findIndex(t => t.id === templateId);

  if (templateIndex === -1) {
    return res.status(404).json({ error: 'Template not found' });
  }

  const updatedTemplate = {
    ...db.templates[templateIndex],
    ...req.body,
    version: db.templates[templateIndex].version + 1,
    updatedAt: new Date()
  };

  db.templates[templateIndex] = updatedTemplate;
  res.json(updatedTemplate);
});

// SMTP Accounts routes
// Old SMTP routes removed - using new database routes below

// Follow-up jobs routes
app.get('/api/followups', authenticateToken, (req, res) => {
  let jobs = db.followupJobs;

  // Filter by role
  if (req.user.role === 'Agent') {
    const clientIds = db.clients.filter(c => c.ownerUserId === req.user.id).map(c => c.id);
    jobs = jobs.filter(j => clientIds.includes(j.clientId));
  }

  res.json(jobs);
});

app.post('/api/followups/:id/pause', authenticateToken, (req, res) => {
  const jobId = req.params.id;
  const jobIndex = db.followupJobs.findIndex(j => j.id === jobId);

  if (jobIndex === -1) {
    return res.status(404).json({ error: 'Follow-up job not found' });
  }

  db.followupJobs[jobIndex].paused = true;
  res.json(db.followupJobs[jobIndex]);
});

app.post('/api/followups/:id/resume', authenticateToken, (req, res) => {
  const jobId = req.params.id;
  const jobIndex = db.followupJobs.findIndex(j => j.id === jobId);

  if (jobIndex === -1) {
    return res.status(404).json({ error: 'Follow-up job not found' });
  }

  db.followupJobs[jobIndex].paused = false;
  res.json(db.followupJobs[jobIndex]);
});

app.post('/api/followups/:id/stop', authenticateToken, (req, res) => {
  const jobId = req.params.id;
  const jobIndex = db.followupJobs.findIndex(j => j.id === jobId);

  if (jobIndex === -1) {
    return res.status(404).json({ error: 'Follow-up job not found' });
  }

  db.followupJobs[jobIndex].status = 'stopped';
  res.json(db.followupJobs[jobIndex]);
});

// Email logs routes
app.get('/api/email-logs', authenticateToken, (req, res) => {
  let logs = db.emailLogs;

  // Filter by role
  if (req.user.role === 'Agent') {
    const clientIds = db.clients.filter(c => c.ownerUserId === req.user.id).map(c => c.id);
    logs = logs.filter(l => clientIds.includes(l.clientId));
  }

  if (req.query.client_id) {
    logs = logs.filter(l => l.clientId === req.query.client_id);
  }
  if (req.query.status) {
    logs = logs.filter(l => l.status === req.query.status);
  }

  res.json(logs);
});

// Dashboard routes
app.get('/api/dashboard/stats', authenticateToken, (req, res) => {
  const conferenceId = req.query.conference_id || db.conferences[0]?.id;
  
  const stats = {
    totalClients: db.clients.filter(c => c.conferenceId === conferenceId).length,
    abstractsSubmitted: db.clients.filter(c => c.conferenceId === conferenceId && c.status === 'Abstract Submitted').length,
    registered: db.clients.filter(c => c.conferenceId === conferenceId && c.status === 'Registered').length,
    unresponsive: db.clients.filter(c => c.conferenceId === conferenceId && c.status === 'Unresponsive').length,
    activeFollowups: db.followupJobs.filter(j => j.status === 'active' && !j.paused).length,
    emailsSentToday: db.emailLogs.filter(l => {
      const today = new Date();
      const logDate = new Date(l.sentAt);
      return logDate.toDateString() === today.toDateString();
    }).length
  };

  stats.conversionRate = stats.totalClients > 0 ? (stats.registered / stats.totalClients * 100).toFixed(2) : 0;

  res.json(stats);
});

// Email Client routes
app.get('/api/emails', authenticateToken, (req, res) => {
  let emails = db.emails.filter(e => !e.isDeleted);
  
  // Filter by role
  if (req.user.role === 'Agent') {
    const clientIds = db.clients.filter(c => c.ownerUserId === req.user.id).map(c => c.id);
    emails = emails.filter(e => clientIds.includes(e.clientId));
  }
  
  // Apply folder filters
  if (req.query.folder) {
    switch (req.query.folder) {
      case 'inbox':
        emails = emails.filter(e => !e.isSent && !e.isDraft);
        break;
      case 'sent':
        emails = emails.filter(e => e.isSent);
        break;
      case 'drafts':
        emails = emails.filter(e => e.isDraft);
        break;
      case 'important':
        emails = emails.filter(e => e.isImportant);
        break;
      case 'trash':
        emails = emails.filter(e => e.isDeleted);
        break;
    }
  }
  
  // Apply additional filters
  if (req.query.filter) {
    switch (req.query.filter) {
      case 'unread':
    emails = emails.filter(e => !e.isRead);
        break;
      case 'important':
        emails = emails.filter(e => e.isImportant);
        break;
      case 'attachments':
        emails = emails.filter(e => e.attachments && e.attachments.length > 0);
        break;
      case 'today':
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        emails = emails.filter(e => {
          const emailDate = new Date(e.receivedAt || e.sentAt);
          return emailDate >= today;
        });
        break;
      case 'thisweek':
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        emails = emails.filter(e => {
          const emailDate = new Date(e.receivedAt || e.sentAt);
          return emailDate >= weekAgo;
        });
        break;
    }
  }
  
  // Search functionality
  if (req.query.search) {
    const searchTerm = req.query.search.toLowerCase();
    emails = emails.filter(e => 
      e.subject.toLowerCase().includes(searchTerm) ||
      e.from.toLowerCase().includes(searchTerm) ||
      e.to.toLowerCase().includes(searchTerm) ||
      (e.bodyText && e.bodyText.toLowerCase().includes(searchTerm))
    );
  }
  
  // Sort functionality
  const sort = req.query.sort || 'date';
  switch (sort) {
    case 'date':
  emails.sort((a, b) => {
    const dateA = a.receivedAt || a.sentAt;
    const dateB = b.receivedAt || b.sentAt;
    return new Date(dateB) - new Date(dateA);
  });
      break;
    case 'from':
      emails.sort((a, b) => a.from.localeCompare(b.from));
      break;
    case 'subject':
      emails.sort((a, b) => a.subject.localeCompare(b.subject));
      break;
    case 'size':
      emails.sort((a, b) => (b.size || 0) - (a.size || 0));
      break;
  }
  
  res.json(emails);
});

app.get('/api/emails/:id', authenticateToken, (req, res) => {
  const emailId = req.params.id;
  const email = db.emails.find(e => e.id === emailId && !e.isDeleted);
  
  if (!email) {
    return res.status(404).json({ error: 'Email not found' });
  }
  
  // Check permissions
  if (req.user.role === 'Agent') {
    const clientIds = db.clients.filter(c => c.ownerUserId === req.user.id).map(c => c.id);
    if (!clientIds.includes(email.clientId)) {
      return res.status(403).json({ error: 'Access denied' });
    }
  }
  
  // Mark as read if it's not sent by current user
  if (!email.isSent && email.from !== req.user.email) {
    email.isRead = true;
  }
  
  res.json(email);
});

// Update email endpoint
app.put('/api/emails/:id', authenticateToken, (req, res) => {
  const emailId = req.params.id;
  const emailIndex = db.emails.findIndex(e => e.id === emailId);
  
  if (emailIndex === -1) {
    return res.status(404).json({ error: 'Email not found' });
  }
  
  // Check permissions
  if (req.user.role === 'Agent') {
    const clientIds = db.clients.filter(c => c.ownerUserId === req.user.id).map(c => c.id);
    if (!clientIds.includes(db.emails[emailIndex].clientId)) {
      return res.status(403).json({ error: 'Access denied' });
    }
  }
  
  // Update email
  const updatedEmail = {
    ...db.emails[emailIndex],
    ...req.body,
    updatedAt: new Date()
  };
  
  db.emails[emailIndex] = updatedEmail;
  res.json(updatedEmail);
});

// Delete email endpoint
app.delete('/api/emails/:id', authenticateToken, (req, res) => {
  const emailId = req.params.id;
  const emailIndex = db.emails.findIndex(e => e.id === emailId);
  
  if (emailIndex === -1) {
    return res.status(404).json({ error: 'Email not found' });
  }
  
  // Check permissions
  if (req.user.role === 'Agent') {
    const clientIds = db.clients.filter(c => c.ownerUserId === req.user.id).map(c => c.id);
    if (!clientIds.includes(db.emails[emailIndex].clientId)) {
      return res.status(403).json({ error: 'Access denied' });
    }
  }
  
  // Soft delete
  db.emails[emailIndex].isDeleted = true;
  db.emails[emailIndex].deletedAt = new Date();
  
  res.json({ success: true, message: 'Email deleted successfully' });
});

app.post('/api/emails', authenticateToken, (req, res) => {
  const { to, cc, bcc, subject, body, bodyText, isDraft, clientId, templateId } = req.body;
  
  const email = {
    id: uuidv4(),
    from: req.user.email,
    to,
    cc: cc || '',
    bcc: bcc || '',
    subject,
    body,
    bodyText,
    isRead: false,
    isImportant: false,
    isDraft: isDraft || false,
    isSent: !isDraft,
    isDeleted: false,
    threadId: uuidv4(),
    inReplyTo: null,
    attachments: [],
    sentAt: isDraft ? null : new Date(),
    receivedAt: null,
    clientId: clientId || null,
    userId: req.user.id
  };
  
  db.emails.push(email);
  
  // If not a draft, send the email
  if (!isDraft) {
    // pick SMTP account (system default for now)
    const smtpAccount = db.smtpAccounts.find(a => a.isSystem);
    if (!smtpAccount) {
      return res.status(500).json({ error: 'No SMTP account configured' });
    }

    sendEmail(to, subject, body, smtpAccount)
      .then(result => {
        // Log email
        db.emailLogs.push({
          id: uuidv4(),
          clientId: clientId || null,
          from: smtpAccount.fromEmail,
          to,
          subject,
          bodyPreview: (bodyText || '').substring(0, 100),
          status: result.success ? 'sent' : 'failed',
          smtpAccountId: smtpAccount.id,
          messageId: result.messageId,
          sentAt: new Date(),
          attempts: 1,
          errorText: result.success ? null : result.error
        });

        if (!result.success) {
          return res.status(502).json({ error: `SMTP send failed: ${result.error}` });
        }

        return res.status(201).json(email);
      })
      .catch(err => {
        return res.status(502).json({ error: `SMTP error: ${err.message}` });
      });
    return; // prevent double send
  }
  
  res.status(201).json(email);
});

app.put('/api/emails/:id', authenticateToken, (req, res) => {
  const emailId = req.params.id;
  const emailIndex = db.emails.findIndex(e => e.id === emailId && !e.isDeleted);
  
  if (emailIndex === -1) {
    return res.status(404).json({ error: 'Email not found' });
  }
  
  const email = db.emails[emailIndex];
  
  // Check permissions
  if (req.user.role === 'Agent') {
    const clientIds = db.clients.filter(c => c.ownerUserId === req.user.id).map(c => c.id);
    if (!clientIds.includes(email.clientId)) {
      return res.status(403).json({ error: 'Access denied' });
    }
  }
  
  // Update email
  const updatedEmail = {
    ...email,
    ...req.body,
    id: email.id, // Preserve ID
    from: email.from, // Preserve from
    userId: email.userId // Preserve userId
  };
  
  db.emails[emailIndex] = updatedEmail;
  res.json(updatedEmail);
});

app.post('/api/emails/:id/reply', authenticateToken, (req, res) => {
  const emailId = req.params.id;
  const originalEmail = db.emails.find(e => e.id === emailId && !e.isDeleted);
  
  if (!originalEmail) {
    return res.status(404).json({ error: 'Email not found' });
  }
  
  const { body, bodyText } = req.body;
  
  const replyEmail = {
    id: uuidv4(),
    from: req.user.email,
    to: originalEmail.from,
    cc: '',
    bcc: '',
    subject: originalEmail.subject.startsWith('Re:') ? originalEmail.subject : `Re: ${originalEmail.subject}`,
    body,
    bodyText,
    isRead: false,
    isImportant: false,
    isDraft: false,
    isSent: true,
    isDeleted: false,
    threadId: originalEmail.threadId,
    inReplyTo: originalEmail.id,
    attachments: [],
    sentAt: new Date(),
    receivedAt: null,
    clientId: originalEmail.clientId,
    userId: req.user.id
  };
  
  db.emails.push(replyEmail);
  res.status(201).json(replyEmail);
});

app.post('/api/emails/:id/forward', authenticateToken, (req, res) => {
  const emailId = req.params.id;
  const originalEmail = db.emails.find(e => e.id === emailId && !e.isDeleted);
  
  if (!originalEmail) {
    return res.status(404).json({ error: 'Email not found' });
  }
  
  const { to, cc, bcc, body, bodyText } = req.body;
  
  const forwardEmail = {
    id: uuidv4(),
    from: req.user.email,
    to,
    cc: cc || '',
    bcc: bcc || '',
    subject: originalEmail.subject.startsWith('Fwd:') ? originalEmail.subject : `Fwd: ${originalEmail.subject}`,
    body,
    bodyText,
    isRead: false,
    isImportant: false,
    isDraft: false,
    isSent: true,
    isDeleted: false,
    threadId: uuidv4(),
    inReplyTo: null,
    attachments: [...originalEmail.attachments],
    sentAt: new Date(),
    receivedAt: null,
    clientId: null,
    userId: req.user.id
  };
  
  db.emails.push(forwardEmail);
  res.status(201).json(forwardEmail);
});

app.delete('/api/emails/:id', authenticateToken, (req, res) => {
  const emailId = req.params.id;
  const emailIndex = db.emails.findIndex(e => e.id === emailId && !e.isDeleted);
  
  if (emailIndex === -1) {
    return res.status(404).json({ error: 'Email not found' });
  }
  
  // Soft delete
  db.emails[emailIndex].isDeleted = true;
  res.json({ message: 'Email deleted successfully' });
});

app.get('/api/emails/thread/:threadId', authenticateToken, (req, res) => {
  const threadId = req.params.threadId;
  const emails = db.emails.filter(e => e.threadId === threadId && !e.isDeleted);
  
  // Sort by date
  emails.sort((a, b) => {
    const dateA = a.receivedAt || a.sentAt;
    const dateB = b.receivedAt || b.sentAt;
    return new Date(dateA) - new Date(dateB);
  });
  
  res.json(emails);
});

// Test IMAP connection endpoint
app.post('/api/inbound/test', authenticateToken, requireRole(['CEO', 'Manager']), async (req, res) => {
  const { accountId } = req.body;
  
  let account;
  if (accountId) {
    account = db.smtpAccounts.find(a => a.id === accountId);
  } else {
    account = db.smtpAccounts.find(a => a.imapHost && a.imapUsername);
  }
  
  if (!account) {
    return res.status(400).json({ error: 'No IMAP-enabled account configured' });
  }

  try {
    // Validate configuration first
    const validation = imapService.validateImapConfig({...account});
    if (!validation.isValid) {
      return res.status(400).json({ 
        success: false, 
        error: `Configuration error: ${validation.errors.join(', ')}`,
        suggestions: getImapSuggestions(account.imapHost)
      });
    }

    const result = await imapService.testConnection(validation.account);
    res.json(result);
  } catch (error) {
    console.error('IMAP test error:', error.message);
    res.status(502).json({ 
      success: false, 
      error: error.message,
      suggestions: getImapSuggestions(account.imapHost)
    });
  }
});

// Helper function to provide IMAP configuration suggestions
function getImapSuggestions(host) {
  if (!host) return [];
  
  const hostLower = host.toLowerCase();
  const suggestions = [];
  
  if (hostLower.includes('gmail')) {
    suggestions.push('For Gmail: Use imap.gmail.com, port 993, SSL security');
    suggestions.push('Make sure to use App Password, not regular password');
    suggestions.push('Enable 2-Step Verification in Google Account');
  } else if (hostLower.includes('outlook') || hostLower.includes('hotmail')) {
    suggestions.push('For Outlook: Use outlook.office365.com, port 993, SSL security');
  } else if (hostLower.includes('yahoo')) {
    suggestions.push('For Yahoo: Use imap.mail.yahoo.com, port 993, SSL security');
    suggestions.push('Use App Password, not regular password');
  }
  
  return suggestions;
}

// Fetch emails from IMAP endpoint
app.post('/api/inbound/fetch', authenticateToken, requireRole(['CEO', 'Manager']), async (req, res) => {
  const { accountId, maxMessages = 10 } = req.body;
  
  let account;
  if (accountId) {
    account = db.smtpAccounts.find(a => a.id === accountId);
  } else {
    account = db.smtpAccounts.find(a => a.imapHost && a.imapUsername);
  }
  
  if (!account) {
    return res.status(400).json({ error: 'No IMAP-enabled account configured' });
  }

  try {
    const result = await imapService.fetchEmails(account, { maxMessages });
    res.json(result);
  } catch (error) {
    res.status(502).json({ success: false, error: error.message });
  }
});

// Get IMAP status endpoint
app.get('/api/inbound/status', authenticateToken, requireRole(['CEO', 'Manager']), (req, res) => {
  const status = imapService.getStatus();
  res.json(status);
});

// Start/Stop IMAP polling endpoint
app.post('/api/inbound/polling', authenticateToken, requireRole(['CEO']), async (req, res) => {
  const { action } = req.body;
  
  try {
    if (action === 'start') {
      await imapService.startPolling(db);
      res.json({ success: true, message: 'IMAP polling started' });
    } else if (action === 'stop') {
      imapService.stopPolling();
      res.json({ success: true, message: 'IMAP polling stopped' });
    } else {
      res.status(400).json({ error: 'Invalid action. Use "start" or "stop"' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Clear all emails endpoint (for removing demo data)
app.post('/api/emails/clear', authenticateToken, requireRole(['CEO']), (req, res) => {
  try {
    // Clear all emails and email logs
    db.emails = [];
    db.emailLogs = [];
    
    res.json({ 
      success: true, 
      message: 'All emails and logs cleared successfully',
      cleared: {
        emails: 0,
        emailLogs: 0
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Reset email state endpoint
app.post('/api/emails/reset', authenticateToken, requireRole(['CEO']), (req, res) => {
  try {
    // Clear all emails, logs, and reset IMAP polling
    const emailCount = db.emails.length;
    const logCount = db.emailLogs.length;
    
    db.emails = [];
    db.emailLogs = [];
    
    // Stop current IMAP polling
    imapService.stopPolling();
    
    res.json({ 
      success: true, 
      message: 'Email state reset successfully',
      cleared: {
        emails: emailCount,
        emailLogs: logCount
      },
      imapStatus: 'Stopped - restart polling to fetch real emails'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Email sending function
const sendEmail = async (to, subject, body, smtpAccount) => {
  try {
    const transporter = nodemailer.createTransport({
      host: smtpAccount.host,
      port: Number(smtpAccount.port) || 587,
      secure: smtpAccount.security === 'ssl' || Number(smtpAccount.port) === 465,
      auth: smtpAccount.username && smtpAccount.password ? {
        user: smtpAccount.username,
        pass: smtpAccount.password
      } : undefined,
    });

    const mailOptions = {
      from: smtpAccount.fromEmail,
      to: to,
      subject: subject,
      html: body
    };

    const result = await transporter.sendMail(mailOptions);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Template rendering function
const renderTemplate = (template, variables) => {
  let rendered = { ...template };
  
  Object.keys(variables).forEach(key => {
    const placeholder = `{${key}}`;
    rendered.subject = rendered.subject.replace(new RegExp(placeholder, 'g'), variables[key]);
    rendered.bodyHtml = rendered.bodyHtml.replace(new RegExp(placeholder, 'g'), variables[key]);
    rendered.bodyText = rendered.bodyText.replace(new RegExp(placeholder, 'g'), variables[key]);
  });

  return rendered;
};

// Follow-up scheduler (runs every minute)
cron.schedule('* * * * *', async () => {
  const now = new Date();
  const dueJobs = db.followupJobs.filter(job => 
    job.status === 'active' && 
    !job.paused && 
    new Date(job.nextSendAt) <= now &&
    job.attemptsDone < job.maxAttempts
  );

  for (const job of dueJobs) {
    const client = db.clients.find(c => c.id === job.clientId);
    if (!client) continue;

    const conference = db.conferences.find(c => c.id === job.conferenceId);
    if (!conference) continue;

    // Find appropriate template
    let template;
    if (job.stage === 1) {
      template = job.attemptsDone === 0 
        ? db.templates.find(t => t.stage === 'abstract_invite')
        : db.templates.find(t => t.stage === 'abstract_followup');
    } else if (job.stage === 2) {
      template = db.templates.find(t => t.stage === 'registration');
    }

    if (!template) continue;

    // Render template
    const variables = {
      Name: `${client.firstName} ${client.lastName}`,
      ConferenceName: conference.name,
      Email: client.email,
      Country: client.country
    };

    const renderedTemplate = renderTemplate(template, variables);

    // Get SMTP account
    const smtpAccount = db.smtpAccounts.find(a => a.isSystem && a.allowUsers);
    if (!smtpAccount) continue;

    // Send email
    const result = await sendEmail(client.email, renderedTemplate.subject, renderedTemplate.bodyHtml, smtpAccount);

    // Log email
    const emailLog = {
      id: uuidv4(),
      clientId: client.id,
      from: smtpAccount.fromEmail,
      to: client.email,
      subject: renderedTemplate.subject,
      bodyPreview: renderedTemplate.bodyText.substring(0, 100),
      status: result.success ? 'sent' : 'failed',
      smtpAccountId: smtpAccount.id,
      messageId: result.messageId,
      sentAt: new Date(),
      attempts: 1,
      errorText: result.success ? null : result.error
    };

    db.emailLogs.push(emailLog);

    // Update follow-up job
    job.attemptsDone += 1;
    job.lastSentAt = new Date();

    if (job.attemptsDone >= job.maxAttempts) {
      job.status = 'completed';
      // Mark client as unresponsive if no response
      if (client.status === 'Lead' || client.status === 'Abstract Submitted') {
        const clientIndex = db.clients.findIndex(c => c.id === client.id);
        if (clientIndex !== -1) {
          db.clients[clientIndex].status = 'Unresponsive';
        }
      }
    } else {
      // Calculate next send time
      let nextSend = new Date(job.lastSentAt);
      nextSend.setDate(nextSend.getDate() + job.intervalDays);

      // Skip weekends if configured
      if (job.intervalSkipWeekends) {
        while (nextSend.getDay() === 0 || nextSend.getDay() === 6) {
          nextSend.setDate(nextSend.getDate() + 1);
        }
      }

      job.nextSendAt = nextSend;
    }
  }
});

// Start services
setTimeout(async () => {
  try {
    await imapService.startPolling(db);
    console.log('IMAP polling service started');
  } catch (error) {
    console.error('Failed to start IMAP polling:', error.message);
  }

  try {
    await followUpService.initialize(db);
    console.log('Follow-up service started');
  } catch (error) {
    console.error('Failed to start follow-up service:', error.message);
  }
}, 5000); // Start after 5 seconds to allow server to fully initialize

// Real-time email sync endpoint
app.post('/api/emails/sync', authenticateToken, async (req, res) => {
  try {
  const accounts = db.smtpAccounts.filter(a => a.imapHost && a.imapUsername);
    let totalProcessed = 0;
    let totalErrors = 0;

  for (const account of accounts) {
    try {
        const result = await imapService.processIncomingEmails(account, db);
        totalProcessed += result.processed;
        totalErrors += result.errors;
      } catch (error) {
        console.error(`Sync error for account ${account.name}:`, error.message);
        totalErrors++;
      }
    }

    res.json({
      success: true,
      message: `Sync completed: ${totalProcessed} emails processed, ${totalErrors} errors`,
      processed: totalProcessed,
      errors: totalErrors
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get email statistics
app.get('/api/emails/stats', authenticateToken, (req, res) => {
  const stats = {
    total: db.emails.length,
    unread: db.emails.filter(e => !e.isRead).length,
    important: db.emails.filter(e => e.isImportant).length,
    withAttachments: db.emails.filter(e => e.attachments?.length > 0).length,
    sent: db.emails.filter(e => e.isSent).length,
    drafts: db.emails.filter(e => e.isDraft).length,
    deleted: db.emails.filter(e => e.isDeleted).length
  };

  res.json(stats);
});

// Follow-up API endpoints
app.get('/api/followup/jobs', authenticateToken, (req, res) => {
  const jobs = db.followupJobs.map(job => {
    const client = db.clients.find(c => c.id === job.clientId);
    return {
      ...job,
      client: client ? { id: client.id, name: client.name, email: client.email, status: client.status } : null
    };
  });
  res.json(jobs);
});

app.post('/api/followup/jobs', authenticateToken, (req, res) => {
  const { clientId, stage, intervalDays } = req.body;
  
  const client = db.clients.find(c => c.id === clientId);
  if (!client) {
    return res.status(404).json({ error: 'Client not found' });
  }

  const job = followUpService.createFollowUpJob(clientId, stage, req.user.id, intervalDays);
  res.status(201).json(job);
});

app.put('/api/followup/jobs/:id/pause', authenticateToken, (req, res) => {
  const jobId = req.params.id;
  followUpService.pauseJob(jobId);
  res.json({ success: true, message: 'Job paused' });
});

app.put('/api/followup/jobs/:id/resume', authenticateToken, (req, res) => {
  const jobId = req.params.id;
  followUpService.resumeJob(jobId);
  res.json({ success: true, message: 'Job resumed' });
});

app.put('/api/followup/jobs/:id/stop', authenticateToken, (req, res) => {
  const jobId = req.params.id;
  followUpService.stopJob(jobId);
  res.json({ success: true, message: 'Job stopped' });
});

app.get('/api/followup/stats', authenticateToken, (req, res) => {
  const stats = followUpService.getStatistics();
  res.json(stats);
});

// Email API routes
app.use('/api/emails', authenticateToken, emailRoutes);
app.use('/api/email-accounts', authenticateToken, emailAccountRoutes);

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
