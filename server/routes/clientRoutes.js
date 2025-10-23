const express = require('express');
const router = express.Router();
const { Client, Conference, EmailTemplate, EmailLog, EmailAccount, Email, FollowUpJob } = require('../models');
const { Op } = require('sequelize');
const jwt = require('jsonwebtoken');
const EmailService = require('../services/EmailService');
const TemplateEngine = require('../services/TemplateEngine');
const FollowUpAutomation = require('../services/FollowUpAutomation');

// JWT Secret from environment or default
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Middleware to check authentication
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access denied' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      console.error('JWT verification error:', err.message);
      return res.status(403).json({ error: 'Invalid token', details: err.message });
    }
    req.user = user;
    next();
  });
};

// GET /api/clients - Get all clients
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { 
      conferenceId, 
      status, 
      country, 
      search, 
      sortBy = 'createdAt', 
      sortOrder = 'DESC',
      page = 1,
      limit = 50
    } = req.query;

    // Build where clause
    const whereClause = {};
    
    if (conferenceId) {
      whereClause.conferenceId = conferenceId;
    }
    
    if (status && status !== 'All Statuses') {
      whereClause.status = status;
    }
    
    if (country && country !== 'All Countries') {
      whereClause.country = country;
    }
    
    if (search) {
      whereClause[Op.or] = [
        { firstName: { [Op.like]: `%${search}%` } },
        { lastName: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { organization: { [Op.like]: `%${search}%` } }
      ];
    }

    // Map sortBy 'name' to 'firstName' since we don't have a 'name' column
    const actualSortBy = sortBy === 'name' ? 'firstName' : sortBy;

    // Get clients with pagination
    const { count, rows: clientsRaw } = await Client.findAndCountAll({
      where: whereClause,
      order: [[actualSortBy, sortOrder]],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit)
    });

    // Manually fetch conferences for each client
    const clients = [];
    for (const client of clientsRaw) {
      const clientData = client.toJSON();
      if (clientData.conferenceId) {
        const conference = await Conference.findByPk(clientData.conferenceId, {
          attributes: ['id', 'name', 'startDate', 'endDate'],
          raw: true
        });
        clientData.conference = conference || null;
      } else {
        clientData.conference = null;
      }
      clients.push(clientData);
    }

    res.json({
      clients,
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / parseInt(limit))
    });
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// GET /api/clients/:id - Get client by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const client = await Client.findByPk(id, {
      include: [
        { 
          model: Conference, 
          as: 'conference', 
          attributes: ['id', 'name', 'startDate', 'endDate'] 
        }
      ]
    });

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    res.json(client);
  } catch (error) {
    console.error('Error fetching client:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/clients - Create new client
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      country,
      organization,
      position,
      status = 'Lead',
      conferenceId,
      notes,
      emailCount = 0,
      currentStage = 'initial',
      followUpCount = 0,
      lastEmailSent = null,
      nextEmailDate = null,
      manualEmailsCount = 0
    } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !email) {
      return res.status(400).json({ error: 'First name, last name, and email are required' });
    }

    // Check if client already exists
    const existingClient = await Client.findOne({ where: { email } });
    if (existingClient) {
      return res.status(400).json({ error: 'Client with this email already exists' });
    }

    console.log('📝 Creating client in database...');
    
    // Create client
    const client = await Client.create({
      firstName,
      lastName,
      email,
      phone,
      country,
      organization,
      position,
      status,
      conferenceId,
      notes,
      emailCount,
      currentStage,
      followUpCount,
      lastEmailSent,
      nextEmailDate,
      manualEmailsCount: parseInt(manualEmailsCount) || 0,
      organizationId: req.user.organizationId || null
    });

    console.log(`✅ Client created: ${client.id}, Conference: ${conferenceId || 'None'}`);

    // Start automatic email workflow if client is assigned to a conference
    if (conferenceId) {
      console.log(`🎯 TRIGGERING EMAIL WORKFLOW - Client: ${client.id}, Conference: ${conferenceId}`);
      try {
        console.log(`🚀 Starting automatic email workflow for client ${client.id}, conference ${conferenceId}`);
        await startAutomaticEmailWorkflow(client.id, conferenceId);
        console.log(`✅ WORKFLOW COMPLETED - Started automatic email workflow for client ${client.id}`);
      } catch (emailError) {
        console.error(`❌ ERROR IN WORKFLOW - Failed to start email workflow:`, emailError.message);
        console.error('Stack trace:', emailError.stack);
        // Don't fail the client creation if email workflow fails
      }
    } else {
      console.log(`⚠️ NO CONFERENCE - Skipping email workflow for client ${client.id}`);
    }

    console.log(`📤 Sending response for client ${client.email}`);

    res.status(201).json({ 
      message: 'Client created successfully', 
      client: {
        id: client.id,
        firstName: client.firstName,
        lastName: client.lastName,
        email: client.email,
        status: client.status,
        currentStage: client.currentStage
      }
    });
  } catch (error) {
    console.error('Error creating client:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// PUT /api/clients/:id - Update client
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const client = await Client.findByPk(id);
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Capture old status before update
    const oldStatus = client.status;
    
    // Update client
    await client.update(updateData);
    
    // Check if status changed and handle stage progression
    const newStatus = client.status;
    if (oldStatus !== newStatus) {
      console.log(`🔄 Client status changed: ${oldStatus} → ${newStatus}`);
      await handleStageProgression(client, oldStatus, newStatus);
    }

    res.json({ message: 'Client updated successfully', client });
  } catch (error) {
    console.error('Error updating client:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/clients/:id - Delete client
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const client = await Client.findByPk(id);
    
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    await client.destroy();
    res.json({ message: 'Client deleted successfully' });
  } catch (error) {
    console.error('Error deleting client:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/clients/bulk-delete - Delete multiple clients
router.post('/bulk-delete', authenticateToken, async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Invalid or empty client IDs array' });
    }

    // Delete all specified clients
    const deletedCount = await Client.destroy({
      where: {
        id: ids
      }
    });

    // Also delete any associated follow-up jobs
    await FollowUpJob.destroy({
      where: {
        clientId: ids
      }
    });

    res.json({ 
      message: `Successfully deleted ${deletedCount} client(s)`,
      deletedCount
    });
  } catch (error) {
    console.error('Error bulk deleting clients:', error);
    res.status(500).json({ error: 'Failed to delete clients', details: error.message });
  }
});

// POST /api/clients/bulk-status - Update status for multiple clients
router.post('/bulk-status', authenticateToken, async (req, res) => {
  try {
    const { ids, status } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Invalid or empty client IDs array' });
    }

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    // Validate status
    const validStatuses = ['Lead', 'Abstract Submitted', 'Registered', 'Unresponsive', 'Registration Unresponsive', 'Rejected', 'Completed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    // Get all clients to handle stage progression
    const clients = await Client.findAll({
      where: {
        id: ids
      }
    });

    // Update each client and handle stage progression
    for (const client of clients) {
      const oldStatus = client.status;
      await client.update({ status });
      
      // Handle stage progression for status changes
      if (oldStatus !== status) {
        await handleStageProgression(client, oldStatus, status);
      }
    }

    res.json({ 
      message: `Successfully updated status for ${clients.length} client(s) to ${status}`,
      updatedCount: clients.length
    });
  } catch (error) {
    console.error('Error bulk updating status:', error);
    res.status(500).json({ error: 'Failed to update status', details: error.message });
  }
});

// POST /api/clients/bulk-assign-conference - Assign conference to multiple clients
router.post('/bulk-assign-conference', authenticateToken, async (req, res) => {
  try {
    const { ids, conferenceId } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Invalid or empty client IDs array' });
    }

    if (!conferenceId) {
      return res.status(400).json({ error: 'Conference ID is required' });
    }

    // Verify conference exists
    const conference = await Conference.findByPk(conferenceId);
    if (!conference) {
      return res.status(404).json({ error: 'Conference not found' });
    }

    // Get all clients
    const clients = await Client.findAll({
      where: {
        id: ids
      }
    });

    // Update each client and potentially start email workflows
    for (const client of clients) {
      const oldConferenceId = client.conferenceId;
      await client.update({ conferenceId });

      // If client didn't have a conference before, start email workflow
      if (!oldConferenceId && conferenceId) {
        try {
          console.log(`🚀 Starting automatic email workflow for client ${client.id}, conference ${conferenceId}`);
          await startAutomaticEmailWorkflow(client.id, conferenceId);
        } catch (emailError) {
          console.error(`❌ Failed to start email workflow for client ${client.id}:`, emailError.message);
          // Don't fail the entire operation if email workflow fails
        }
      }
    }

    res.json({ 
      message: `Successfully assigned ${clients.length} client(s) to conference ${conference.name}`,
      updatedCount: clients.length
    });
  } catch (error) {
    console.error('Error bulk assigning conference:', error);
    res.status(500).json({ error: 'Failed to assign conference', details: error.message });
  }
});

// Function to handle stage progression when client status changes
async function handleStageProgression(client, oldStatus, newStatus) {
  try {
    console.log(`🔄 Handling stage progression for client ${client.email}: ${oldStatus} → ${newStatus}`);

    // Case 1: Client registered - Stop all follow-up jobs
    if (newStatus === 'Registered') {
      console.log(`✅ Client registered - stopping all follow-up jobs`);
      
      const activeJobs = await FollowUpJob.findAll({
        where: {
          clientId: client.id,
          status: 'active'
        }
      });

      for (const job of activeJobs) {
        await job.update({
          status: 'stopped',
          completedAt: new Date()
        });
        console.log(`✅ Stopped job ${job.id} (Stage: ${job.stage})`);
      }
      
      // Update client stage to completed
      await client.update({ currentStage: 'completed' });
    }

    // Case 2: Client submitted abstract - Stop Stage 1 jobs, ensure Stage 2 jobs exist
    if (newStatus === 'Abstract Submitted') {
      console.log(`📝 Client submitted abstract - transitioning to Stage 2 (Registration) only`);
      
      // Stop all Stage 1 (abstract_submission) follow-up jobs
      const stage1Jobs = await FollowUpJob.findAll({
        where: {
          clientId: client.id,
          stage: 'abstract_submission',
          status: 'active'
        }
      });

      for (const job of stage1Jobs) {
        await job.update({
          status: 'stopped',
          completedAt: new Date()
        });
        console.log(`✅ Stopped Stage 1 job ${job.id} - client submitted abstract`);
      }

      // Check if Stage 2 jobs already exist
      const stage2Jobs = await FollowUpJob.findAll({
        where: {
          clientId: client.id,
          stage: 'registration'
        }
      });

      // Create Stage 2 jobs if they don't exist
      if (stage2Jobs.length === 0 && client.conferenceId) {
        console.log(`📅 Creating Stage 2 (Registration) follow-up jobs`);
        const conference = await Conference.findByPk(client.conferenceId);
        if (conference) {
          await createStage2FollowUpJobs(client, conference);
        }
      } else {
        console.log(`ℹ️  Stage 2 jobs already exist, no action needed`);
      }

      // Update client stage to stage2
      await client.update({ currentStage: 'stage2' });
    }

    console.log(`✅ Stage progression completed for ${client.email}`);
  } catch (error) {
    console.error(`❌ Error handling stage progression:`, error);
    throw error;
  }
}

// Function to create Stage 2 (registration) follow-up jobs
async function createStage2FollowUpJobs(client, conference) {
  try {
    console.log(`📅 Creating Stage 2 (registration) follow-up jobs for ${client.email}`);

    // Get conference settings for Stage 2 intervals
    const settings = conference.settings || {};
    const followupIntervals = settings.followup_intervals || { "Stage1": { value: 7, unit: "days" }, "Stage2": { value: 3, unit: "days" } };
    const maxAttempts = settings.max_attempts || { "Stage1": 6, "Stage2": 6 };
    const stage2Interval = followupIntervals.Stage2 || { value: 3, unit: "days" };
    const stage2MaxFollowUps = maxAttempts.Stage2 || 6;
    const skipWeekends = settings.skip_weekends !== false;

    // Get or create Stage 2 (Registration) template
    let stage2Template = await EmailTemplate.findOne({
      where: {
        conferenceId: conference.id,
        stage: 'registration',
        isActive: true
      }
    });

    if (!stage2Template) {
      stage2Template = await EmailTemplate.create({
        organizationId: conference.organizationId || '00000000-0000-0000-0000-000000000001',
        conferenceId: conference.id,
        name: 'Stage 2 - Registration',
        subject: `${conference.name} - Registration Reminder`,
        bodyHtml: `<p>Dear {{client.firstName}} {{client.lastName}},</p>
<p>Thank you for submitting your abstract for <strong>{{conference.name}}</strong>!</p>
<p>This is a friendly reminder to complete your registration.</p>
<p><strong>Registration Details:</strong></p>
<ul>
  <li><strong>Conference:</strong> {{conference.name}}</li>
  <li><strong>Deadline:</strong> {{conference.registrationDeadline}}</li>
  <li><strong>Venue:</strong> {{conference.venue}}</li>
  <li><strong>Dates:</strong> {{conference.startDate}} to {{conference.endDate}}</li>
  {{#if conference.website}}<li><strong>Register at:</strong> <a href="{{conference.website}}">{{conference.website}}</a></li>{{/if}}
</ul>
<p>We look forward to your participation!</p>
<p>Best regards,<br>Conference Team</p>`,
        bodyText: `Dear {{client.firstName}} {{client.lastName}},\n\nThank you for submitting your abstract for {{conference.name}}!\n\nThis is a friendly reminder to complete your registration.\n\nRegistration Details:\n- Conference: {{conference.name}}\n- Deadline: {{conference.registrationDeadline}}\n- Venue: {{conference.venue}}\n- Dates: {{conference.startDate}} to {{conference.endDate}}\n{{#if conference.website}}- Register at: {{conference.website}}{{/if}}\n\nWe look forward to your participation!\n\nBest regards,\nConference Team`,
        stage: 'registration',
        isActive: true
      });
    }

    // Get the most recent email's messageId for threading (from Stage 1 emails)
    const { Email } = require('../models');
    const latestEmail = await Email.findOne({
      where: {
        clientId: client.id,
        isSent: true
      },
      order: [['createdAt', 'DESC']]
    });

    // Calculate first follow-up date for Stage 2
    const firstFollowUpDate = calculateNextSendDate(stage2Interval, skipWeekends);
    const stage2IntervalMs = intervalToMilliseconds(stage2Interval);

    // Create FollowUpJob for Stage 2 with threading to continue the conversation
    const followUpJob = await FollowUpJob.create({
      clientId: client.id,
      conferenceId: conference.id,
      templateId: stage2Template.id,
      stage: 'registration',
      scheduledDate: firstFollowUpDate,
      status: 'active',
      paused: false,
      skipWeekends: skipWeekends,
      customInterval: Math.max(1, Math.round(stage2IntervalMs / (24 * 60 * 60 * 1000))),
      maxAttempts: stage2MaxFollowUps,
      currentAttempt: 0,
      settings: {
        timezone: settings.timezone || 'UTC',
        workingHours: settings.workingHours || { start: '09:00', end: '17:00' },
        intervalConfig: stage2Interval,
        threadRootMessageId: latestEmail?.messageId // Continue the email thread
      }
    });

    console.log(`✅ Created Stage 2 follow-up job ${followUpJob.id} for ${client.email}`);
  } catch (error) {
    console.error('❌ Error creating Stage 2 follow-up jobs:', error);
    throw error;
  }
}

// Function to start automatic email workflow
async function startAutomaticEmailWorkflow(clientId, conferenceId) {
  try {
    console.log(`🚀 Starting automatic email workflow for client ${clientId} in conference ${conferenceId}`);
    
    // Get client and conference details
    const client = await Client.findByPk(clientId);
    const conference = await Conference.findByPk(conferenceId);
    
    if (!client || !conference) {
      throw new Error('Client or conference not found');
    }

    const manualCount = client.manualEmailsCount || 0;
    console.log(`📊 Client entry point: Status="${client.status}", Stage="${client.currentStage}", ManualEmailsCount=${manualCount}`);

    // Get email templates for this conference
    const templates = await EmailTemplate.findAll({
      where: { conferenceId: conferenceId }
    });

    if (templates.length === 0) {
      console.log('⚠️ No email templates found for conference, using default templates');
      // Create default templates if none exist
      await createDefaultTemplates(conferenceId);
    }

    // Handle workflow based on status and stage combination
    if (client.status === 'Registered' || client.currentStage === 'completed') {
      console.log(`✅ Client is Registered or Completed - No emails will be sent`);
      await client.update({ currentStage: 'completed' });
      return;
    }

    if (client.status === 'Abstract Submitted' && client.currentStage === 'stage2') {
      console.log(`📧 Client already submitted abstract - Starting Stage 2 (Registration) emails ONLY`);
      await client.update({ currentStage: 'stage2' });
      await createStage2FollowUpJobs(client, conference);
    } else if (client.status === 'Lead' && client.currentStage === 'initial') {
      console.log(`📧 New Lead client - Starting full workflow: Initial → Stage 1 → Stage 2`);
      
      // If manualEmailsCount > 0, skip initial email (it was sent manually)
      if (manualCount === 0) {
        await sendInitialEmail(client, conference);
      } else {
        console.log(`⏭️  Skipping initial email (already sent manually)`);
      }
      
      // Update stage to stage1 after sending/skipping initial email
      await client.update({ currentStage: 'stage1' });
      // Schedule Stage 1 and Stage 2 follow-up emails (will skip already-sent ones)
      await scheduleFollowUpEmails(client, conference);
    } else if (client.currentStage === 'stage1') {
      console.log(`📧 Client starting at Stage 1 - Skipping initial email, sending Stage 1 and Stage 2`);
      await scheduleFollowUpEmails(client, conference);
    } else {
      console.log(`⚠️ Unexpected status/stage combination: ${client.status}/${client.currentStage} - Using default workflow`);
      // Default to full workflow
      if (manualCount === 0) {
        await sendInitialEmail(client, conference);
      } else {
        console.log(`⏭️  Skipping initial email (already sent manually)`);
      }
      await client.update({ currentStage: 'stage1' });
      await scheduleFollowUpEmails(client, conference);
    }
    
    console.log(`✅ Automatic email workflow started for client ${clientId}`);
  } catch (error) {
    console.error('❌ Error in automatic email workflow:', error);
    throw error;
  }
}

// Function to send initial email
async function sendInitialEmail(client, conference) {
  try {
    console.log(`📧 Sending initial invitation email to ${client.email}`);
    
    // Get SMTP account for the organization
    const smtpAccount = await EmailAccount.findOne({
      where: {
        isActive: true
      },
      order: [['createdAt', 'DESC']]
    });

    if (!smtpAccount) {
      console.log('⚠️ No SMTP account found, skipping email send');
      return;
    }
    
    console.log(`📧 Using SMTP account: ${smtpAccount.email} (${smtpAccount.smtpHost})`);

    // Get initial invitation template
    let template = await EmailTemplate.findOne({
      where: {
        conferenceId: conference.id,
        stage: 'initial_invitation',
        isActive: true
      }
    });

    // If no template exists, create a default one
    if (!template) {
      template = await EmailTemplate.create({
        organizationId: conference.organizationId || '00000000-0000-0000-0000-000000000001',
        conferenceId: conference.id,
        name: 'Initial Invitation',
        subject: `Invitation to ${conference.name}`,
        bodyHtml: `<p>Dear {{client.firstName}},</p>
<p>You are cordially invited to participate in <strong>{{conference.name}}</strong>.</p>
<p><strong>Conference Details:</strong></p>
<ul>
  <li><strong>Venue:</strong> {{conference.venue}}</li>
  <li><strong>Dates:</strong> {{conference.startDate}} to {{conference.endDate}}</li>
  {{#if conference.website}}<li><strong>Website:</strong> <a href="{{conference.website}}">{{conference.website}}</a></li>{{/if}}
</ul>
<p>We look forward to your participation!</p>
<p>Best regards,<br>Conference Team</p>`,
        bodyText: `Dear {{client.firstName}},\n\nYou are cordially invited to participate in {{conference.name}}.\n\nConference Details:\n- Venue: {{conference.venue}}\n- Dates: {{conference.startDate}} to {{conference.endDate}}\n{{#if conference.website}}- Website: {{conference.website}}{{/if}}\n\nWe look forward to your participation!\n\nBest regards,\nConference Team`,
        stage: 'initial_invitation',
        isActive: true
      });
    }

    // Render template with client data
    const templateEngine = new TemplateEngine();
    const renderedTemplate = await templateEngine.renderTemplate(template.id, client.id, conference.id);

    // Validate subject line and fall back to template.subject if empty
    const emailSubject = renderedTemplate.subject && renderedTemplate.subject.trim() 
      ? renderedTemplate.subject 
      : template.subject;
    
    if (!emailSubject || !emailSubject.trim()) {
      throw new Error('Email subject cannot be empty');
    }

    console.log(`📧 Sending email with subject: "${emailSubject}"`);

    // Send email using nodemailer directly
    const nodemailer = require('nodemailer');
    
    // Create transporter for this SMTP account
    const transporter = nodemailer.createTransport({
      host: smtpAccount.smtpHost,
      port: smtpAccount.smtpPort,
      secure: smtpAccount.smtpPort === 465,
      auth: {
        user: smtpAccount.smtpUsername,
        pass: smtpAccount.smtpPassword
      }
    });

    // Send the email (this is the INITIAL email - no threading headers needed)
    const mailResult = await transporter.sendMail({
      from: `${smtpAccount.name || 'Conference CRM'} <${smtpAccount.email}>`,
      to: client.email,
      subject: emailSubject,
      text: renderedTemplate.bodyText,
      html: renderedTemplate.bodyHtml
    });

    // Create email record in database (store messageId for threading)
    const initialEmail = await Email.create({
      from: smtpAccount.email,
      to: client.email,
      subject: emailSubject,
      bodyHtml: renderedTemplate.bodyHtml,
      bodyText: renderedTemplate.bodyText,
      date: new Date(),
      clientId: client.id,
      conferenceId: conference.id,
      templateId: template.id,
      emailAccountId: smtpAccount.id,
      isSent: true,
      status: 'sent',
      messageId: mailResult.messageId,
      deliveredAt: new Date()
    });

    console.log(`✅ Email sent: ${mailResult.messageId}`);

    // Update client engagement and stage
    const currentEngagement = client.engagement || {};
    await client.update({
      engagement: {
        ...currentEngagement,
        emailsSent: (currentEngagement.emailsSent || 0) + 1,
        lastEmailSent: new Date()
      },
      currentStage: 'stage1',
      followUpCount: 0,
      lastFollowUpDate: new Date()
    });

    console.log(`✅ Initial invitation email sent to ${client.email}, moved to stage1`);
  } catch (error) {
    console.error('❌ Error sending initial email:', error);
    throw error;
  }
}

// Function to schedule follow-up emails
async function scheduleFollowUpEmails(client, conference) {
  try {
    console.log(`📅 Creating follow-up job for ${client.email}`);
    
    // Get conference settings for follow-up intervals
    const settings = conference.settings || {};
    const followupIntervals = settings.followup_intervals || { "Stage1": { value: 7, unit: "days" }, "Stage2": { value: 3, unit: "days" } };
    const maxAttempts = settings.max_attempts || { "Stage1": 6, "Stage2": 6 };
    const stage1Interval = followupIntervals.Stage1 || { value: 7, unit: "days" };
    const stage1MaxFollowUps = maxAttempts.Stage1 || 6;
    const skipWeekends = settings.skip_weekends !== false;
    
    // Store interval in customInterval as milliseconds for flexibility
    const stage1IntervalMs = intervalToMilliseconds(stage1Interval);

    // Get or create Stage 1 (Abstract Submission) template
    let stage1Template = await EmailTemplate.findOne({
      where: {
        conferenceId: conference.id,
        stage: 'abstract_submission',
        isActive: true
      }
    });

    if (!stage1Template) {
      stage1Template = await EmailTemplate.create({
        organizationId: conference.organizationId || '00000000-0000-0000-0000-000000000001',
        conferenceId: conference.id,
        name: 'Stage 1 - Abstract Submission',
        subject: `${conference.name} - Abstract Submission Reminder`,
        bodyHtml: `<p>Dear {{client.firstName}} {{client.lastName}},</p>
<p>This is a friendly reminder about submitting your abstract for <strong>{{conference.name}}</strong>.</p>
<p><strong>Abstract Submission Details:</strong></p>
<ul>
  <li><strong>Conference:</strong> {{conference.name}}</li>
  <li><strong>Deadline:</strong> {{conference.abstractDeadline}}</li>
  <li><strong>Venue:</strong> {{conference.venue}}</li>
  {{#if conference.website}}<li><strong>Submit at:</strong> <a href="{{conference.website}}">{{conference.website}}</a></li>{{/if}}
</ul>
<p>We encourage you to submit your abstract at your earliest convenience.</p>
<p>Best regards,<br>Conference Team</p>`,
        bodyText: `Dear {{client.firstName}} {{client.lastName}},\n\nThis is a friendly reminder about submitting your abstract for {{conference.name}}.\n\nAbstract Submission Details:\n- Conference: {{conference.name}}\n- Deadline: {{conference.abstractDeadline}}\n- Venue: {{conference.venue}}\n{{#if conference.website}}- Submit at: {{conference.website}}{{/if}}\n\nWe encourage you to submit your abstract at your earliest convenience.\n\nBest regards,\nConference Team`,
        stage: 'abstract_submission',
        isActive: true
      });
    }

    // Get the initial email's messageId for threading
    const initialEmail = await Email.findOne({
      where: {
        clientId: client.id,
        isSent: true
      },
      order: [['createdAt', 'DESC']],
      limit: 1
    });

    // Calculate first follow-up date
    const firstFollowUpDate = calculateNextSendDate(stage1Interval, skipWeekends);

    // Calculate starting attempt based on manualEmailsCount
    // manualEmailsCount includes the initial email + follow-ups
    // If manualEmailsCount = 3 (initial + 2 follow-ups sent), start at attempt 2
    const manualCount = client.manualEmailsCount || 0;
    const startingAttempt = Math.max(0, manualCount - 1); // -1 because initial email is separate
    
    if (startingAttempt > 0) {
      console.log(`⏭️  Skipping first ${startingAttempt} Stage 1 emails (already sent manually)`);
    }

    // Only create job if there are still emails to send
    if (startingAttempt < stage1MaxFollowUps) {
      // Create FollowUpJob for Stage 1 with initial email's messageId for threading
      const followUpJob = await FollowUpJob.create({
        clientId: client.id,
        conferenceId: conference.id,
        templateId: stage1Template.id,
        stage: 'abstract_submission',
        scheduledDate: firstFollowUpDate,
        status: 'active',
        paused: false,
        skipWeekends: skipWeekends,
        customInterval: Math.max(1, Math.round(stage1IntervalMs / (24 * 60 * 60 * 1000))), // Round to nearest day (min 1)
        maxAttempts: stage1MaxFollowUps,
        currentAttempt: startingAttempt, // Start from the correct attempt number
        settings: {
          timezone: settings.timezone || 'UTC',
          workingHours: settings.workingHours || { start: '09:00', end: '17:00' },
          intervalConfig: stage1Interval, // Store original interval config (THIS is what we use!)
          threadRootMessageId: initialEmail?.messageId // Store initial email's messageId for threading
        }
      });

      console.log(`✅ Created follow-up job ${followUpJob.id} for client ${client.email} (Stage 1, starting at attempt ${startingAttempt + 1})`);
    } else {
      console.log(`⏭️  All Stage 1 emails already sent manually - no follow-up job created`);
    }
  } catch (error) {
    console.error('❌ Error scheduling follow-up emails:', error);
    throw error;
  }
}

// Helper function to convert interval to milliseconds
function intervalToMilliseconds(interval) {
  // Support both old format (number = days) and new format ({ value, unit })
  if (typeof interval === 'number') {
    return interval * 24 * 60 * 60 * 1000; // days
  }
  
  if (typeof interval === 'object' && interval.value && interval.unit) {
    const value = interval.value;
    const unit = interval.unit.toLowerCase();
    
    switch (unit) {
      case 'minutes':
        return value * 60 * 1000;
      case 'hours':
        return value * 60 * 60 * 1000;
      case 'days':
        return value * 24 * 60 * 60 * 1000;
      default:
        return value * 24 * 60 * 60 * 1000; // default to days
    }
  }
  
  return 7 * 24 * 60 * 60 * 1000; // fallback to 7 days
}

// Helper function to calculate next send date with weekend skipping
function calculateNextSendDate(interval, skipWeekends = true) {
  const now = new Date();
  const milliseconds = intervalToMilliseconds(interval);
  let nextDate = new Date(now.getTime() + milliseconds);
  
  // Skip weekends if enabled (only for intervals >= 1 day)
  if (skipWeekends && milliseconds >= 24 * 60 * 60 * 1000) {
    while (nextDate.getDay() === 0 || nextDate.getDay() === 6) {
      nextDate.setDate(nextDate.getDate() + 1);
    }
  }
  
  return nextDate;
}

// Function to create default email templates
async function createDefaultTemplates(conferenceId) {
  try {
    const defaultTemplates = [
      {
        name: 'Initial Invitation',
        subject: 'Invitation to {{conference.name}}',
        bodyHtml: '<p>Dear {{client.firstName}} {{client.lastName}},</p>\n<p>You are invited to participate in <strong>{{conference.name}}</strong>.</p>\n<p>Conference Details:\n<ul>\n  <li>Venue: {{conference.venue}}</li>\n  <li>Dates: {{conference.startDate}} to {{conference.endDate}}</li>\n</ul>\n</p>\n<p>Best regards,<br>Conference Team</p>',
        bodyText: 'Dear {{client.firstName}} {{client.lastName}},\n\nYou are invited to participate in {{conference.name}}.\n\nConference Details:\n- Venue: {{conference.venue}}\n- Dates: {{conference.startDate}} to {{conference.endDate}}\n\nBest regards,\nConference Team',
        emailType: 'initial_invitation',
        stage: 'initial_invitation',
        conferenceId: conferenceId,
        isActive: true
      },
      {
        name: 'Abstract Submission Follow-up',
        subject: 'Follow-up: {{conference.name}} - Abstract Submission',
        bodyHtml: '<p>Dear {{client.firstName}} {{client.lastName}},</p>\n<p>This is a follow-up regarding your participation in <strong>{{conference.name}}</strong>. Please submit your abstract.</p>\n<p>Abstract Deadline: {{conference.abstractDeadline}}</p>\n<p>Best regards,<br>Conference Team</p>',
        bodyText: 'Dear {{client.firstName}} {{client.lastName}},\n\nThis is a follow-up regarding your participation in {{conference.name}}. Please submit your abstract.\n\nAbstract Deadline: {{conference.abstractDeadline}}\n\nBest regards,\nConference Team',
        emailType: 'stage1_followup',
        stage: 'abstract_submission',
        conferenceId: conferenceId,
        isActive: true
      },
      {
        name: 'Registration Follow-up',
        subject: 'Follow-up: {{conference.name}} - Registration',
        bodyHtml: '<p>Dear {{client.firstName}} {{client.lastName}},</p>\n<p>This is a follow-up regarding your participation in <strong>{{conference.name}}</strong>. Please complete your registration.</p>\n<p>Registration Deadline: {{conference.registrationDeadline}}</p>\n<p>Best regards,<br>Conference Team</p>',
        bodyText: 'Dear {{client.firstName}} {{client.lastName}},\n\nThis is a follow-up regarding your participation in {{conference.name}}. Please complete your registration.\n\nRegistration Deadline: {{conference.registrationDeadline}}\n\nBest regards,\nConference Team',
        emailType: 'stage2_followup',
        stage: 'registration',
        conferenceId: conferenceId,
        isActive: true
      }
    ];

    for (const template of defaultTemplates) {
      await EmailTemplate.create(template);
    }

    console.log('✅ Created default email templates');
  } catch (error) {
    console.error('❌ Error creating default templates:', error);
    throw error;
  }
}

// GET /api/clients/template/download - Download Excel template
router.get('/template/download', authenticateToken, async (req, res) => {
  try {
    const XLSX = require('xlsx');
    
    // Get all conferences for dropdown validation
    const conferences = await Conference.findAll({
      attributes: ['id', 'name'],
      order: [['name', 'ASC']]
    });
    
    // Create template data with example row
    const templateData = [
      {
        'First Name': 'John',
        'Last Name': 'Doe',
        'Email': 'john.doe@example.com',
        'Phone': '+1234567890',
        'Country': 'USA',
        'Organization': 'Tech Corp',
        'Position': 'Professor',
        'Conference': conferences.length > 0 ? conferences[0].name : 'Select Conference',
        'Status': 'Lead',
        'Stage': 'initial',
        'Emails Already Sent': 0,
        'Notes': 'Example client'
      }
    ];
    
    // Create worksheet
    const worksheet = XLSX.utils.json_to_sheet(templateData);
    
    // Set column widths
    worksheet['!cols'] = [
      { wch: 15 }, // First Name
      { wch: 15 }, // Last Name
      { wch: 25 }, // Email
      { wch: 15 }, // Phone
      { wch: 15 }, // Country
      { wch: 20 }, // Organization
      { wch: 20 }, // Position
      { wch: 25 }, // Conference
      { wch: 20 }, // Status
      { wch: 15 }, // Stage
      { wch: 20 }, // Emails Already Sent
      { wch: 30 }  // Notes
    ];
    
    // Add data validation for dropdowns
    const statusOptions = ['Lead', 'Abstract Submitted', 'Registered', 'Unresponsive', 'Registration Unresponsive'];
    const stageOptions = ['initial', 'stage1', 'stage2', 'completed'];
    const conferenceNames = conferences.map(c => c.name);
    
    // Create a second sheet with instructions
    const instructions = [
      ['Conference CRM - Bulk Client Upload Template'],
      [''],
      ['Instructions:'],
      ['1. Fill in client details in the "Clients" sheet'],
      ['2. REQUIRED fields: First Name, Last Name, Email'],
      ['3. OPTIONAL fields: Conference, Status, Stage, Emails Already Sent, Phone, Country, Organization, Position, Notes'],
      ['4. Use the dropdown values for Status, Stage, and Conference columns if provided'],
      ['5. Delete the example row before uploading'],
      [''],
      ['Field Defaults:'],
      ['- Status: Defaults to "Lead" if not provided'],
      ['- Stage: Defaults to "initial" if not provided'],
      ['- Conference: Optional - email workflow only starts if Conference is assigned'],
      ['- Emails Already Sent: Enter number of emails sent manually (default 0). Automation will skip these emails.'],
      [''],
      ['Available Options:'],
      ['Status Options:', statusOptions.join(', ')],
      ['Stage Options:', stageOptions.join(', ')],
      ['Conference Options:', conferenceNames.length > 0 ? conferenceNames.join(', ') : 'None configured yet'],
      [''],
      ['Workflow Guide:'],
      ['- No Conference = No automated emails (can assign conference later)'],
      ['- Lead + initial + Conference = Full workflow (invitation + Stage 1 + Stage 2)'],
      ['- Abstract Submitted + stage2 + Conference = Only Stage 2 emails (registration)'],
      ['- Registered + completed = No emails sent'],
      [''],
      ['Flexible Usage:'],
      ['- Upload clients with just basic info (name, email) now'],
      ['- Add conference assignment later to trigger email workflows'],
      ['- Perfect for importing existing contacts first, then organizing them'],
      ['- Use "Emails Already Sent" if you already emailed some clients manually (e.g., 3 = skip first 3 automated emails)'],
      [''],
      ['Note: Save this file and upload it with your client data']
    ];
    
    const instructionSheet = XLSX.utils.aoa_to_sheet(instructions);
    instructionSheet['!cols'] = [{ wch: 50 }, { wch: 50 }];
    
    // Create workbook with both sheets
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Clients');
    XLSX.utils.book_append_sheet(workbook, instructionSheet, 'Instructions');
    
    // Generate buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    // Send file
    res.setHeader('Content-Disposition', 'attachment; filename="client-upload-template.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
    
  } catch (error) {
    console.error('Error generating template:', error);
    res.status(500).json({ error: 'Failed to generate template', details: error.message });
  }
});

// POST /api/clients/bulk-upload - Upload and process Excel file
router.post('/bulk-upload', authenticateToken, async (req, res) => {
  try {
    const XLSX = require('xlsx');
    const multer = require('multer');
    const upload = multer({ storage: multer.memoryStorage() });
    
    // Handle file upload
    upload.single('file')(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ error: 'File upload failed', details: err.message });
      }
      
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      
      try {
        // Parse Excel file
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet);
        
        if (data.length === 0) {
          return res.status(400).json({ error: 'Excel file is empty' });
        }
        
        // Get all conferences for mapping
        const conferences = await Conference.findAll({
          attributes: ['id', 'name']
        });
        const conferenceMap = {};
        conferences.forEach(c => {
          conferenceMap[c.name] = c.id;
        });
        
        const results = {
          success: 0,
          failed: 0,
          errors: []
        };
        
        // Process each row
        for (let i = 0; i < data.length; i++) {
          const row = data[i];
          const rowNum = i + 2; // Excel rows start at 1, plus header
          
          try {
            // Validate only REQUIRED fields: firstName, lastName, email
            if (!row['First Name'] || !row['Last Name'] || !row['Email']) {
              results.failed++;
              results.errors.push(`Row ${rowNum}: Missing required fields (First Name, Last Name, or Email)`);
              continue;
            }
            
            // Check for duplicate email
            const existingClient = await Client.findOne({ where: { email: row['Email'] } });
            if (existingClient) {
              results.failed++;
              results.errors.push(`Row ${rowNum}: Client with email "${row['Email']}" already exists`);
              continue;
            }
            
            // Conference is OPTIONAL - map if provided
            let conferenceId = null;
            if (row['Conference']) {
              conferenceId = conferenceMap[row['Conference']];
              if (!conferenceId) {
                results.failed++;
                results.errors.push(`Row ${rowNum}: Conference "${row['Conference']}" not found`);
                continue;
              }
            }
            
            // Status is OPTIONAL - default to 'Lead'
            const validStatuses = ['Lead', 'Abstract Submitted', 'Registered', 'Unresponsive', 'Registration Unresponsive', 'Rejected', 'Completed'];
            const status = row['Status'] || 'Lead';
            if (!validStatuses.includes(status)) {
              results.failed++;
              results.errors.push(`Row ${rowNum}: Invalid status "${status}". Valid options: ${validStatuses.join(', ')}`);
              continue;
            }
            
            // Stage is OPTIONAL - default to 'initial'
            const validStages = ['initial', 'stage1', 'stage2', 'completed'];
            const stage = row['Stage'] || 'initial';
            if (!validStages.includes(stage)) {
              results.failed++;
              results.errors.push(`Row ${rowNum}: Invalid stage "${stage}". Valid options: ${validStages.join(', ')}`);
              continue;
            }
            
            // Parse manualEmailsCount (optional, default 0)
            const manualEmailsCount = parseInt(row['Emails Already Sent']) || 0;
            
            // Create client with all optional fields
            const client = await Client.create({
              firstName: row['First Name'],
              lastName: row['Last Name'],
              email: row['Email'],
              phone: row['Phone'] || null,
              country: row['Country'] || null,
              organization: row['Organization'] || null,
              position: row['Position'] || null,
              status: status,
              conferenceId: conferenceId || null,
              currentStage: stage,
              manualEmailsCount: manualEmailsCount,
              notes: row['Notes'] || null,
              organizationId: req.user.organizationId || null
            });
            
            console.log(`✅ Created client: ${client.email} - Conference: ${conferenceId ? 'Yes' : 'None'}`);
            
            // Start automatic email workflow ONLY if conference is assigned
            if (conferenceId) {
              try {
                console.log(`🚀 Starting email workflow for ${client.email}`);
                await startAutomaticEmailWorkflow(client.id, conferenceId);
              } catch (emailError) {
                console.error(`❌ Failed to start workflow for ${client.email}:`, emailError.message);
                // Don't fail the entire import if email workflow fails
              }
            } else {
              console.log(`⚠️  No conference assigned for ${client.email} - skipping email workflow`);
            }
            
            results.success++;
            
          } catch (rowError) {
            results.failed++;
            results.errors.push(`Row ${rowNum}: ${rowError.message}`);
          }
        }
        
        // Send response
        res.json({
          message: 'Bulk upload completed',
          results: results
        });
        
      } catch (processingError) {
        console.error('Error processing Excel file:', processingError);
        res.status(500).json({ error: 'Failed to process Excel file', details: processingError.message });
      }
    });
    
  } catch (error) {
    console.error('Error in bulk upload:', error);
    res.status(500).json({ error: 'Bulk upload failed', details: error.message });
  }
});

// Export router and workflow function
module.exports = router;
module.exports.startAutomaticEmailWorkflow = startAutomaticEmailWorkflow;
