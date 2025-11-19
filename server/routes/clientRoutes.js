const express = require('express');
const router = express.Router();
const { Client, Conference, EmailTemplate, EmailLog, EmailAccount, Email, FollowUpJob, ClientNote, User } = require('../models');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const jwt = require('jsonwebtoken');
const EmailService = require('../services/EmailService');
const clientNoteRoutes = require('./clientNoteRoutes');
const XLSX = require('xlsx');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const EmailJobScheduler = require('../services/EmailJobScheduler');

const DEFAULT_STAGE1_INTERVAL = { value: 7, unit: 'days' };
const DEFAULT_STAGE2_INTERVAL = { value: 3, unit: 'days' };
const DEFAULT_STAGE1_MAX = 6;
const DEFAULT_STAGE2_MAX = 6;
const DEFAULT_WORKING_HOURS = { start: '09:00', end: '17:00' };
const DEFAULT_TIMEZONE = 'UTC';
const VALID_INTERVAL_UNITS = new Set(['minutes', 'hours', 'days']);

const immediateEmailScheduler = new EmailJobScheduler();

const sanitizeNonNegativeInt = (value, defaultValue = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return defaultValue;
  }
  return Math.floor(parsed);
};

const deriveManualCountsForCreate = (payload = {}) => {
  const hasStage1 = Object.prototype.hasOwnProperty.call(payload, 'manualStage1Count');
  const hasLegacy = Object.prototype.hasOwnProperty.call(payload, 'manualEmailsCount');
  const hasStage2 = Object.prototype.hasOwnProperty.call(payload, 'manualStage2Count');

  const stage1Count = hasStage1
    ? sanitizeNonNegativeInt(payload.manualStage1Count)
    : sanitizeNonNegativeInt(hasLegacy ? payload.manualEmailsCount : 0);

  const stage2Count = hasStage2
    ? sanitizeNonNegativeInt(payload.manualStage2Count)
    : 0;

  return {
    manualStage1Count: stage1Count,
    manualStage2Count: stage2Count,
    manualEmailsCount: stage1Count
  };
};

const applyManualCountsToUpdatePayload = (payload = {}) => {
  const updates = {};

  if (Object.prototype.hasOwnProperty.call(payload, 'manualStage1Count')) {
    const stage1Count = sanitizeNonNegativeInt(payload.manualStage1Count);
    updates.manualStage1Count = stage1Count;
    updates.manualEmailsCount = stage1Count;
  }

  if (
    Object.prototype.hasOwnProperty.call(payload, 'manualEmailsCount') &&
    !Object.prototype.hasOwnProperty.call(payload, 'manualStage1Count')
  ) {
    const stage1FromLegacy = sanitizeNonNegativeInt(payload.manualEmailsCount);
    updates.manualStage1Count = stage1FromLegacy;
    updates.manualEmailsCount = stage1FromLegacy;
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'manualStage2Count')) {
    updates.manualStage2Count = sanitizeNonNegativeInt(payload.manualStage2Count);
  }

  return updates;
};

const getStage1ManualProgress = (client) => {
  if (!client) return 0;
  if (client.manualStage1Count !== undefined && client.manualStage1Count !== null) {
    return sanitizeNonNegativeInt(client.manualStage1Count);
  }
  return sanitizeNonNegativeInt(client.manualEmailsCount);
};

const getStage2ManualProgress = (client) => {
  if (!client) return 0;
  if (client.manualStage2Count !== undefined && client.manualStage2Count !== null) {
    return sanitizeNonNegativeInt(client.manualStage2Count);
  }
  return 0;
};

const applyBaselineToClientEngagement = async (clientInstance) => {
  if (!clientInstance) return;
  const stage1 = getStage1ManualProgress(clientInstance);
  const stage2 = getStage2ManualProgress(clientInstance);
  const baseline = sanitizeNonNegativeInt(stage1 + stage2);
  if (baseline <= 0) {
    return;
  }

  const currentEngagement = clientInstance.engagement || {};
  const currentSent = sanitizeNonNegativeInt(currentEngagement.emailsSent || 0);
  if (baseline > currentSent) {
    await clientInstance.update({
      engagement: {
        ...currentEngagement,
        emailsSent: baseline
      }
    });
  }
};

const normalizeIntervalConfig = (raw, fallback) => {
  if (raw === null || raw === undefined) {
    return { ...fallback };
  }

  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
    return { value: raw, unit: 'days' };
  }

  if (typeof raw === 'string' && raw.trim() !== '') {
    const parsed = Number(raw.trim());
    if (Number.isFinite(parsed) && parsed > 0) {
      return { value: parsed, unit: 'days' };
    }
  }

  if (typeof raw === 'object') {
    const value = Number(raw.value);
    const unit = typeof raw.unit === 'string' ? raw.unit.toLowerCase() : fallback.unit;
    if (Number.isFinite(value) && value > 0) {
      return {
        value,
        unit: VALID_INTERVAL_UNITS.has(unit) ? unit : fallback.unit
      };
    }
  }

  return { ...fallback };
};

const normalizeMaxAttempts = (raw, fallback) => {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.max(1, Math.floor(parsed));
};

const normalizeWorkingHours = (raw) => {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_WORKING_HOURS };
  }
  const start = typeof raw.start === 'string' && raw.start.trim() ? raw.start.trim() : DEFAULT_WORKING_HOURS.start;
  const end = typeof raw.end === 'string' && raw.end.trim() ? raw.end.trim() : DEFAULT_WORKING_HOURS.end;
  return { start, end };
};

const resolveFollowUpConfig = (conference) => {
  const settings = conference?.settings || {};
  const followupIntervals = settings.followup_intervals || {};
  const maxAttempts = settings.max_attempts || {};

  const stage1Interval = normalizeIntervalConfig(followupIntervals.Stage1, DEFAULT_STAGE1_INTERVAL);
  const stage2Interval = normalizeIntervalConfig(followupIntervals.Stage2, DEFAULT_STAGE2_INTERVAL);
  const stage1MaxAttempts = normalizeMaxAttempts(maxAttempts.Stage1, DEFAULT_STAGE1_MAX);
  const stage2MaxAttempts = normalizeMaxAttempts(maxAttempts.Stage2, DEFAULT_STAGE2_MAX);
  const skipWeekends = settings.skip_weekends === undefined ? true : Boolean(settings.skip_weekends);
  const timezone = typeof settings.timezone === 'string' && settings.timezone.trim()
    ? settings.timezone.trim()
    : DEFAULT_TIMEZONE;
  const workingHours = normalizeWorkingHours(settings.working_hours);

  return {
    stage1Interval,
    stage2Interval,
    stage1MaxAttempts,
    stage2MaxAttempts,
    skipWeekends,
    timezone,
    workingHours
  };
};

const getStageTemplateSequence = (conference, stage) => {
  if (!conference) {
    return [];
  }
  const settings = conference.settings || {};
  const rawSequence = stage === 'stage1'
    ? settings.stage1Templates
    : settings.stage2Templates;
  const cleaned = Array.isArray(rawSequence)
    ? rawSequence.map((id) => (typeof id === 'string' ? id.trim() : '')).filter(Boolean)
    : [];
  const fallbackId = stage === 'stage1' ? conference.stage1TemplateId : conference.stage2TemplateId;
  if (!cleaned.length && fallbackId) {
    cleaned.push(fallbackId);
  }
  return cleaned;
};

const getTemplateIdForAttempt = (sequence, attemptIndex) => {
  if (!Array.isArray(sequence) || sequence.length === 0) {
    return null;
  }
  if (attemptIndex <= 0) {
    return sequence[0];
  }
  if (attemptIndex >= sequence.length) {
    return sequence[sequence.length - 1];
  }
  return sequence[attemptIndex];
};

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
      ownerUserId, // Filter by owner
      myClients, // Show only my owned clients
      sortBy = 'createdAt', 
      sortOrder = 'DESC',
      page = 1,
      limit = 50
    } = req.query;

    // Build where clause
    const whereClause = {};
    
    // Role-based filtering: TeamLeads and Members only see clients from their assigned conferences
    if (req.user.role === 'TeamLead') {
      // Get conferences assigned to this TeamLead
      const assignedConferences = await Conference.findAll({
        where: { assignedTeamLeadId: req.user.id },
        attributes: ['id']
      });
      const conferenceIds = assignedConferences.map(c => c.id);
      
      if (conferenceIds.length === 0) {
        // TeamLead has no assigned conferences, return empty list
        console.log(`🔒 TeamLead ${req.user.email} has no assigned conferences`);
        return res.json({ clients: [], total: 0, page: 1, limit: parseInt(limit), totalPages: 0 });
      }
      
      whereClause.conferenceId = { [Op.in]: conferenceIds };
      console.log(`🔒 TeamLead ${req.user.email} - Filtering clients from ${conferenceIds.length} assigned conference(s)`);
    } else if (req.user.role === 'Member') {
      // Get conferences where this Member is in assignedMemberIds (JSON column)
      // Handle both string and numeric storage of member IDs
      const memberIdStr = String(req.user.id);
      const memberIdNum = parseInt(req.user.id, 10);

      const orConditions = [
        sequelize.where(
          sequelize.cast(sequelize.col('assignedMemberIds'), 'jsonb'),
          '@>',
          sequelize.cast(`["${memberIdStr}"]`, 'jsonb')
        )
      ];
      if (!Number.isNaN(memberIdNum)) {
        orConditions.push(
          sequelize.where(
            sequelize.cast(sequelize.col('assignedMemberIds'), 'jsonb'),
            '@>',
            sequelize.cast(`[${memberIdNum}]`, 'jsonb')
          )
        );
      }

      const assignedConferences = await Conference.findAll({
        where: { [Op.or]: orConditions },
        attributes: ['id']
      });
      const conferenceIds = assignedConferences.map(c => c.id);
      
      if (conferenceIds.length === 0) {
        // If no assigned conferences were detected, still allow showing owned clients
        console.log(`🔒 Member ${req.user.email} has no detected assigned conferences. Falling back to owned clients.`);
        whereClause.ownerUserId = req.user.id;
      } else {
        // Members see clients from assigned conferences OR clients they own
        whereClause[Op.or] = [
          { conferenceId: { [Op.in]: conferenceIds } },
          { ownerUserId: req.user.id }
        ];
        console.log(`🔒 Member ${req.user.email} - Filtering clients from ${conferenceIds.length} assigned conference(s) or owned by the member`);
      }
    } else if (req.user.role === 'CEO') {
      console.log(`👑 CEO ${req.user.email} - Showing all clients`);
    }
    
    if (conferenceId) {
      whereClause.conferenceId = conferenceId;
    }
    
    if (status && status !== 'All Statuses') {
      whereClause.status = status;
    }
    
    if (country && country !== 'All Countries') {
      whereClause.country = country;
    }

    // Filter by owner
    if (ownerUserId) {
      whereClause.ownerUserId = ownerUserId;
      console.log(`🔍 Filtering clients by owner: ${ownerUserId}`);
    }

    // "My Clients" filter - show only clients owned by logged-in user
    if (myClients === 'true') {
      whereClause.ownerUserId = req.user.id;
      console.log(`👤 Showing only my clients for ${req.user.email}`);
    }
    
    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } }
      ];
    }

    // Additive email activity filters
    if (req.query && req.query.emailFilter) {
      const emailFilter = req.query.emailFilter;
      if (emailFilter === 'today') {
        const start = new Date(); start.setHours(0,0,0,0);
        const end = new Date(); end.setHours(23,59,59,999);
        const { EmailLog } = require('../models');
        const logs = await EmailLog.findAll({ where: { status: 'sent', sentAt: { [Op.between]: [start, end] } }, attributes: ['clientId'] });
        const ids = Array.from(new Set(logs.map(l => l.clientId).filter(Boolean)));
        if (ids.length === 0) {
          return res.json({ clients: [], total: 0, page: parseInt(page), limit: parseInt(limit), totalPages: 0 });
        }
        whereClause.id = { [Op.in]: ids };
      } else if (emailFilter === 'upcoming') {
        const next7 = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        const { FollowUpJob } = require('../models');
        const jobs = await FollowUpJob.findAll({ where: { status: 'active', nextSendAt: { [Op.lte]: next7 } }, attributes: ['clientId'] });
        const ids = Array.from(new Set(jobs.map(j => j.clientId).filter(Boolean)));
        if (ids.length === 0) {
          return res.json({ clients: [], total: 0, page: parseInt(page), limit: parseInt(limit), totalPages: 0 });
        }
        whereClause.id = { [Op.in]: ids };
      }
    }

    const actualSortBy = sortBy === 'name' ? 'name' : sortBy;

    // Get clients with pagination
    const { count, rows: clientsRaw } = await Client.findAndCountAll({
      where: whereClause,
      order: [[actualSortBy, sortOrder]],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit)
    });

    // Manually fetch conferences and owners for each client
    const clients = [];
    for (const client of clientsRaw) {
      const clientData = client.toJSON();
      
      // Fetch conference data
      if (clientData.conferenceId) {
        const conference = await Conference.findByPk(clientData.conferenceId, {
          attributes: ['id', 'name', 'startDate', 'endDate'],
          raw: true
        });
        clientData.conference = conference || null;
      } else {
        clientData.conference = null;
      }

      // Fetch owner data
      if (clientData.ownerUserId) {
        const owner = await User.findByPk(clientData.ownerUserId, {
          attributes: ['id', 'name', 'email', 'role'],
          raw: true
        });
        clientData.owner = owner || null;
      } else {
        clientData.owner = null;
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

    // Role-based authorization check
    if (req.user.role !== 'CEO' && client.conferenceId) {
      const conference = await Conference.findByPk(client.conferenceId);
      if (conference) {
        let hasAccess = false;
        
        if (req.user.role === 'TeamLead') {
          hasAccess = conference.assignedTeamLeadId === req.user.id;
        } else if (req.user.role === 'Member') {
          const assignedMemberIds = conference.assignedMemberIds || [];
          hasAccess = assignedMemberIds.includes(req.user.id);
        }
        
        if (!hasAccess) {
          console.log(`🚫 ${req.user.role} ${req.user.email} attempted to view client from non-assigned conference`);
          return res.status(403).json({ error: 'You do not have permission to view this client' });
        }
      }
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
      name,
      firstName,
      lastName,
      email,
      country,
      status = 'Lead',
      conferenceId,
      notes,
      emailCount = 0,
      currentStage = 'stage1',
      followUpCount = 0,
      lastEmailSent = null,
      nextEmailDate = null
    } = req.body;

    // Construct name from legacy fields if not provided
    const resolvedName = (name && String(name).trim()) || `${firstName || ''} ${lastName || ''}`.trim();

    // Validate required fields
    if (!resolvedName || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }

    // Check if client already exists
    const existingClient = await Client.findOne({ where: { email } });
    if (existingClient) {
      return res.status(400).json({ error: 'Client with this email already exists' });
    }

    console.log('📝 Creating client in database...');

    const manualCountConfig = deriveManualCountsForCreate(req.body);
    
    // Create client with owner assignment
    const client = await Client.create({
      name: resolvedName,
      email,
      country,
      status,
      conferenceId,
      notes,
      emailCount,
      currentStage,
      followUpCount,
      lastEmailSent,
      nextEmailDate,
      manualEmailsCount: manualCountConfig.manualEmailsCount,
      manualStage1Count: manualCountConfig.manualStage1Count,
      manualStage2Count: manualCountConfig.manualStage2Count,
      organizationId: req.user.organizationId || null,
      ownerUserId: req.body.ownerUserId || req.user.id
    });

    await applyBaselineToClientEngagement(client);

    console.log(`👤 Client assigned to owner: ${client.ownerUserId}`);

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
        name: client.name,
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
    const updateData = { ...req.body };
    const manualCountUpdates = applyManualCountsToUpdatePayload(updateData);
    Object.assign(updateData, manualCountUpdates);

    const client = await Client.findByPk(id);
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Role-based authorization check
    if (req.user.role !== 'CEO' && client.conferenceId) {
      const conference = await Conference.findByPk(client.conferenceId);
      if (conference) {
        let hasAccess = false;
        
        if (req.user.role === 'TeamLead') {
          hasAccess = conference.assignedTeamLeadId === req.user.id;
        } else if (req.user.role === 'Member') {
          const assignedMemberIds = conference.assignedMemberIds || [];
          hasAccess = assignedMemberIds.includes(req.user.id);
        }
        
        if (!hasAccess) {
          console.log(`🚫 ${req.user.role} ${req.user.email} attempted to update client from non-assigned conference`);
          return res.status(403).json({ error: 'You do not have permission to update this client' });
        }
      }
    }

    // Capture old status before update
  const oldStatus = client.status;
    const oldConferenceId = client.conferenceId;
    
    // Update client
    await client.update(updateData);
    await client.reload();
    await applyBaselineToClientEngagement(client);
    const newConferenceId = client.conferenceId;
    
    if (Object.prototype.hasOwnProperty.call(updateData, 'conferenceId') && newConferenceId !== oldConferenceId) {
      console.log(`🔄 Client ${client.id} conference changed: ${oldConferenceId || 'none'} → ${newConferenceId || 'none'}`);
      if (oldConferenceId) {
        try {
          const stoppedJobs = await stopClientFollowUps(client.id);
          console.log(`🛑 Stopped ${stoppedJobs} follow-up job(s) for client ${client.id} (old conference ${oldConferenceId})`);
        } catch (stopError) {
          console.error(`❌ Failed to stop follow-ups for client ${client.id}:`, stopError.message);
        }
      }
      if (newConferenceId) {
        try {
          await startAutomaticEmailWorkflow(client.id, newConferenceId);
          console.log(`🚀 Restarted automatic workflow for client ${client.id} with conference ${newConferenceId}`);
        } catch (workflowError) {
          console.error(`❌ Failed to restart workflow for client ${client.id}:`, workflowError.message);
        }
      }
    }
    
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

    // Role-based authorization check
    if (req.user.role !== 'CEO' && client.conferenceId) {
      const conference = await Conference.findByPk(client.conferenceId);
      if (conference) {
        let hasAccess = false;
        
        if (req.user.role === 'TeamLead') {
          hasAccess = conference.assignedTeamLeadId === req.user.id;
        } else if (req.user.role === 'Member') {
          const assignedMemberIds = conference.assignedMemberIds || [];
          hasAccess = assignedMemberIds.includes(req.user.id);
        }
        
        if (!hasAccess) {
          console.log(`🚫 ${req.user.role} ${req.user.email} attempted to delete client from non-assigned conference`);
          return res.status(403).json({ error: 'You do not have permission to delete this client' });
        }
      }
    }

    await client.destroy();
    console.log(`✅ Client ${client.id} deleted by ${req.user.role} ${req.user.email}`);
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

// PUT /api/clients/:id/assign - Assign/Reassign client to a user
router.put('/:id/assign', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { ownerUserId } = req.body;

    if (!ownerUserId) {
      return res.status(400).json({ error: 'Owner user ID is required' });
    }

    // Get the client
    const client = await Client.findByPk(id);
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Get the new owner
    const newOwner = await User.findByPk(ownerUserId);
    if (!newOwner) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Permission check for TeamLead - can only assign to subordinates
    if (req.user.role === 'TeamLead') {
      // Get subordinates of this TeamLead
      const subordinates = await User.findAll({
        where: { managerId: req.user.id },
        attributes: ['id']
      });
      const subordinateIds = subordinates.map(u => u.id);
      subordinateIds.push(req.user.id); // TeamLead can also assign to self
      
      if (!subordinateIds.includes(ownerUserId)) {
        console.log(`🚫 TeamLead ${req.user.email} attempted to assign client to non-subordinate ${ownerUserId}`);
        return res.status(403).json({ error: 'You can only assign clients to your team members' });
      }
    } else if (req.user.role === 'Member') {
      // Members can only assign to themselves
      if (ownerUserId !== req.user.id) {
        console.log(`🚫 Member ${req.user.email} attempted to assign client to another user`);
        return res.status(403).json({ error: 'Members can only assign clients to themselves' });
      }
    }
    // CEO can assign to anyone (no check)

    // Update client owner
    await client.update({ ownerUserId });
    console.log(`✅ Client ${client.id} assigned to user ${ownerUserId} by ${req.user.role} ${req.user.email}`);

    // Create notification for the assigned user (if different from current user)
    if (ownerUserId !== req.user.id) {
      try {
        const NotificationHelper = require('../utils/notificationHelper');
        const assignedByUser = await User.findByPk(req.user.id, { attributes: ['id', 'name', 'email'] });
        await NotificationHelper.notifyClientAssigned(ownerUserId, client, assignedByUser);
      } catch (notifError) {
        console.error('Error creating assignment notification:', notifError);
        // Don't fail the assignment if notification fails
      }
    }

    res.json({ 
      message: 'Client assigned successfully', 
      client: {
        id: client.id,
        ownerUserId: client.ownerUserId,
        owner: {
          id: newOwner.id,
          name: newOwner.name,
          email: newOwner.email
        }
      }
    });
  } catch (error) {
    console.error('Error assigning client:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// POST /api/clients/bulk-assign - Assign multiple clients to a user
router.post('/bulk-assign', authenticateToken, async (req, res) => {
  try {
    const { ids, ownerUserId } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Invalid or empty client IDs array' });
    }

    if (!ownerUserId) {
      return res.status(400).json({ error: 'Owner user ID is required' });
    }

    // Get the new owner
    const newOwner = await User.findByPk(ownerUserId);
    if (!newOwner) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Permission check for TeamLead
    if (req.user.role === 'TeamLead') {
      const subordinates = await User.findAll({
        where: { managerId: req.user.id },
        attributes: ['id']
      });
      const subordinateIds = subordinates.map(u => u.id);
      subordinateIds.push(req.user.id);
      
      if (!subordinateIds.includes(ownerUserId)) {
        return res.status(403).json({ error: 'You can only assign clients to your team members' });
      }
    } else if (req.user.role === 'Member') {
      if (ownerUserId !== req.user.id) {
        return res.status(403).json({ error: 'Members can only assign clients to themselves' });
      }
    }

    // Update all clients
    const updateResult = await Client.update(
      { ownerUserId },
      { where: { id: ids } }
    );

    console.log(`✅ Bulk assigned ${updateResult[0]} client(s) to user ${ownerUserId} by ${req.user.role} ${req.user.email}`);

    // Create notification for the assigned user (if different from current user)
    if (ownerUserId !== req.user.id && updateResult[0] > 0) {
      try {
        const NotificationHelper = require('../utils/notificationHelper');
        const assignedByUser = await User.findByPk(req.user.id, { attributes: ['id', 'name', 'email'] });
        await NotificationHelper.createNotification({
          userId: ownerUserId,
          title: 'Clients Assigned',
          message: `${updateResult[0]} client(s) have been assigned to you by ${assignedByUser.name}`,
          type: 'client_added',
          data: {
            clientCount: updateResult[0],
            assignedBy: assignedByUser.name
          },
          priority: 'high',
          link: '/clients?myClients=true'
        });
      } catch (notifError) {
        console.error('Error creating bulk assignment notification:', notifError);
      }
    }

    res.json({ 
      message: `Successfully assigned ${updateResult[0]} client(s) to ${newOwner.name}`,
      assignedCount: updateResult[0],
      owner: {
        id: newOwner.id,
        name: newOwner.name,
        email: newOwner.email
      }
    });
  } catch (error) {
    console.error('Error bulk assigning clients:', error);
    res.status(500).json({ error: 'Failed to assign clients', details: error.message });
  }
});

// GET /api/clients/assignable-users - Get users who can be assigned clients
router.get('/assignable-users', authenticateToken, async (req, res) => {
  try {
    let users = [];
    
    if (req.user.role === 'CEO') {
      // CEO can assign to anyone
      users = await User.findAll({
        where: { isActive: true },
        attributes: ['id', 'name', 'email', 'role'],
        order: [['name', 'ASC']]
      });
      console.log(`👑 CEO can assign to ${users.length} users`);
    } else if (req.user.role === 'TeamLead') {
      // TeamLead can assign to self and subordinates
      const subordinates = await User.findAll({
        where: { 
          managerId: req.user.id,
          isActive: true
        },
        attributes: ['id', 'name', 'email', 'role']
      });
      
      // Include self
      const self = await User.findByPk(req.user.id, {
        attributes: ['id', 'name', 'email', 'role']
      });
      
      users = [self, ...subordinates];
      console.log(`🔒 TeamLead can assign to ${users.length} team member(s) (including self)`);
    } else if (req.user.role === 'Member') {
      // Member can only assign to self
      const self = await User.findByPk(req.user.id, {
        attributes: ['id', 'name', 'email', 'role']
      });
      users = [self];
      console.log(`🔒 Member can only assign to self`);
    }

    res.json(users);
  } catch (error) {
    console.error('Error getting assignable users:', error);
    res.status(500).json({ error: 'Internal server error' });
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
    let stoppedJobTotal = 0;
    let restartedClients = 0;

    for (const client of clients) {
      const oldConferenceId = client.conferenceId;
      const conferenceChanged = oldConferenceId !== conferenceId;

      if (conferenceChanged && oldConferenceId) {
        try {
          const stoppedJobs = await stopClientFollowUps(client.id);
          stoppedJobTotal += stoppedJobs;
          console.log(`🛑 Stopped ${stoppedJobs} follow-up job(s) for client ${client.id} (old conference ${oldConferenceId})`);
        } catch (stopError) {
          console.error(`❌ Failed to stop follow-ups for client ${client.id}:`, stopError.message);
        }
      }

      if (conferenceChanged) {
        await client.update({ conferenceId });
      }

      if (conferenceChanged && conferenceId) {
        try {
          console.log(`🚀 Restarting automatic email workflow for client ${client.id}, conference ${conferenceId}`);
          await startAutomaticEmailWorkflow(client.id, conferenceId);
          restartedClients += 1;
        } catch (emailError) {
          console.error(`❌ Failed to restart email workflow for client ${client.id}:`, emailError.message);
        }
      }
    }

    res.json({ 
      message: `Successfully assigned ${clients.length} client(s) to conference ${conference.name}`,
      updatedCount: clients.length,
      followUpsStopped: stoppedJobTotal,
      followUpsRestarted: restartedClients
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

    const followupConfig = resolveFollowUpConfig(conference);
    const { stage2Interval, stage2MaxAttempts, skipWeekends, timezone, workingHours } = followupConfig;
    console.log(
      `⏱️ Stage 2 schedule for conference ${conference.id}: ${stage2Interval.value} ${stage2Interval.unit}, ` +
      `max attempts ${stage2MaxAttempts}, skipWeekends=${skipWeekends}`
    );

    const stage2TemplateSequence = getStageTemplateSequence(conference, 'stage2');
    console.log(`🎯 Stage 2 template sequence for conference ${conference.id}: ${stage2TemplateSequence.join(', ') || 'none defined'}`);

    // Get Stage 2 (Registration) template - USE CONFERENCE'S ASSIGNED TEMPLATE
    let stage2Template = null;

    for (const templateId of stage2TemplateSequence) {
      stage2Template = await EmailTemplate.findByPk(templateId);
      if (stage2Template) {
        console.log(`✅ Using Stage 2 template for follow-up 1: ${stage2Template.name} (ID: ${stage2Template.id})`);
        break;
      } else {
        console.warn(`⚠️ Stage 2 template ${templateId} not found; trying next slot`);
      }
    }

    // Priority 2: Fallback - Find any active registration template
    if (!stage2Template) {
      stage2Template = await EmailTemplate.findOne({
        where: {
          stage: 'registration',
          isActive: true
        },
        order: [['createdAt', 'DESC']]
      });
      if (stage2Template) {
        console.log(`⚠️ Using fallback Stage 2 template: ${stage2Template.name} (ID: ${stage2Template.id})`);
      }
    }

    // Priority 3: Throw error instead of creating hardcoded template
    if (!stage2Template) {
      throw new Error('No registration template found. Please create one in Email Templates and assign it to the conference.');
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

    const manualStage2Progress = getStage2ManualProgress(client);
    const startingAttempt = Math.min(Math.max(0, manualStage2Progress), stage2MaxAttempts);
    const shouldSendImmediately = startingAttempt === 0;
    const firstFollowUpDate = shouldSendImmediately
      ? new Date()
      : calculateNextSendDate(stage2Interval, skipWeekends);

    if (shouldSendImmediately) {
      console.log(`🚀 Immediate Stage 2 follow-up scheduled for ${client.email} at ${firstFollowUpDate.toISOString()}`);
    } else {
      console.log(
        `⏳ Stage 2 automation resumes at attempt ${startingAttempt + 1} for ${client.email} on ${firstFollowUpDate.toISOString()}`
      );
    }

    if (startingAttempt > 0) {
      console.log(`⏭️  Skipping first ${startingAttempt} Stage 2 emails (already sent manually)`);
    }

    if (startingAttempt >= stage2MaxAttempts) {
      console.log(
        `⏹️  Stage 2 manual count (${startingAttempt}) meets or exceeds max ${stage2MaxAttempts}. No automation needed.`
      );
      return;
    }

    // Create FollowUpJob for Stage 2 with threading to continue the conversation
    const followUpJob = await FollowUpJob.create({
      clientId: client.id,
      conferenceId: conference.id,
      templateId: stage2Template.id,
      stage: 'registration',
      scheduledDate: firstFollowUpDate,
      nextSendAt: firstFollowUpDate,
      status: 'active',
      paused: false,
      skipWeekends: skipWeekends,
      customInterval: stage2Interval.unit === 'days' ? Math.max(1, Math.round(stage2Interval.value)) : null,
      maxAttempts: stage2MaxAttempts,
      currentAttempt: startingAttempt,
      settings: {
        timezone,
        workingHours,
        intervalConfig: stage2Interval,
        threadRootMessageId: latestEmail?.messageId, // Continue the email thread
        stageTemplateSequence: stage2TemplateSequence
      }
    });

    console.log(`✅ Created Stage 2 follow-up job ${followUpJob.id} for ${client.email}`);
    if (shouldSendImmediately) {
      await triggerImmediateFollowUpSend(followUpJob.id);
    }
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

    const manualStage1Progress = getStage1ManualProgress(client);
    const manualStage2Progress = getStage2ManualProgress(client);
    console.log(
      `📊 Client entry point: Status="${client.status}", Stage="${client.currentStage}", ` +
      `Stage1Manual=${manualStage1Progress}, Stage2Manual=${manualStage2Progress}`
    );
    console.log(`📋 Conference templates: Stage1=${conference.stage1TemplateId || 'not set'}, Stage2=${conference.stage2TemplateId || 'not set'}`);

    // Handle workflow based on status and stage combination
    if (client.status === 'Registered' || client.currentStage === 'completed') {
      console.log(`✅ Client is Registered or Completed - No emails will be sent`);
      await client.update({ currentStage: 'completed' });
      return;
    }

    if (client.status === 'Abstract Submitted' || client.currentStage === 'stage2') {
      console.log(`📧 Client ready for Stage 2 (Registration) follow-ups`);
      await client.update({ currentStage: 'stage2' });
      await createStage2FollowUpJobs(client, conference);
    } else {
      console.log(`📧 Client entering Stage 1 (Abstract Submission) follow-ups`);
      await client.update({ currentStage: 'stage1' });
      await scheduleFollowUpEmails(client, conference);
    }
    
    console.log(`✅ Automatic email workflow started for client ${clientId}`);
  } catch (error) {
    console.error('❌ Error in automatic email workflow:', error);
    throw error;
  }
}

// Function to schedule follow-up emails
async function scheduleFollowUpEmails(client, conference) {
  try {
    console.log(`📅 Creating follow-up job for ${client.email}`);
    
    const followupConfig = resolveFollowUpConfig(conference);
    const { stage1Interval, stage1MaxAttempts, skipWeekends, timezone, workingHours } = followupConfig;

    console.log(
      `⏱️ Stage 1 schedule for conference ${conference.id}: ${stage1Interval.value} ${stage1Interval.unit}, ` +
      `max attempts ${stage1MaxAttempts}, skipWeekends=${skipWeekends}`
    );

    const stage1TemplateSequence = getStageTemplateSequence(conference, 'stage1');
    console.log(`🎯 Stage 1 template sequence for conference ${conference.id}: ${stage1TemplateSequence.join(', ') || 'none defined'}`);

    // Get Stage 1 (Abstract Submission) template - USE CONFERENCE'S ASSIGNED TEMPLATE(S)
    let stage1Template = null;

    for (const templateId of stage1TemplateSequence) {
      stage1Template = await EmailTemplate.findByPk(templateId);
      if (stage1Template) {
        console.log(`✅ Using Stage 1 template for follow-up 1: ${stage1Template.name} (ID: ${stage1Template.id})`);
        break;
      } else {
        console.warn(`⚠️ Stage 1 template ${templateId} not found; trying next slot`);
      }
    }

    // Priority 2: Fallback - Find any active abstract_submission template
    if (!stage1Template) {
      stage1Template = await EmailTemplate.findOne({
        where: {
          stage: 'abstract_submission',
          isActive: true
        },
        order: [['createdAt', 'DESC']]
      });
      if (stage1Template) {
        console.log(`⚠️ Using fallback Stage 1 template: ${stage1Template.name} (ID: ${stage1Template.id})`);
      }
    }

    // Priority 3: Throw error instead of creating hardcoded template
    if (!stage1Template) {
      throw new Error('No abstract submission template found. Please create one in Email Templates and assign it to the conference.');
    }

    // Get the most recent sent email's messageId for threading
    const initialEmail = await Email.findOne({
      where: {
        clientId: client.id,
        isSent: true
      },
      order: [['createdAt', 'DESC']],
      limit: 1
    });

    const manualStage1Progress = getStage1ManualProgress(client);
    const startingAttempt = Math.min(Math.max(0, manualStage1Progress), stage1MaxAttempts);
    const shouldSendImmediately = startingAttempt === 0;
    const firstFollowUpDate = shouldSendImmediately
      ? new Date()
      : calculateNextSendDate(stage1Interval, skipWeekends);

    if (shouldSendImmediately) {
      console.log(`🚀 Immediate Stage 1 follow-up scheduled for ${client.email} at ${firstFollowUpDate.toISOString()}`);
    } else {
      console.log(
        `⏳ Stage 1 automation resumes at attempt ${startingAttempt + 1} for ${client.email} on ${firstFollowUpDate.toISOString()}`
      );
    }
    
    if (startingAttempt > 0) {
      console.log(`⏭️  Skipping first ${startingAttempt} Stage 1 emails (already sent manually)`);
    }

    // Only create job if there are still emails to send
    if (startingAttempt < stage1MaxAttempts) {
      // Create FollowUpJob for Stage 1 with initial email's messageId for threading
      const followUpJob = await FollowUpJob.create({
        clientId: client.id,
        conferenceId: conference.id,
        templateId: stage1Template.id,
        stage: 'abstract_submission',
        scheduledDate: firstFollowUpDate,
        nextSendAt: firstFollowUpDate,
        status: 'active',
        paused: false,
        skipWeekends: skipWeekends,
        customInterval: stage1Interval.unit === 'days' ? Math.max(1, Math.round(stage1Interval.value)) : null,
        maxAttempts: stage1MaxAttempts,
        currentAttempt: startingAttempt, // Start from the correct attempt number
        settings: {
          timezone,
          workingHours,
          intervalConfig: stage1Interval, // Store original interval config (THIS is what we use!)
          threadRootMessageId: initialEmail?.messageId, // Store initial email's messageId for threading
          stageTemplateSequence: stage1TemplateSequence
        }
      });

      console.log(`✅ Created follow-up job ${followUpJob.id} for client ${client.email} (Stage 1, starting at attempt ${startingAttempt + 1})`);

      if (shouldSendImmediately) {
        await triggerImmediateFollowUpSend(followUpJob.id);
      }
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
  
  if (typeof interval === 'object' && interval !== null && interval.value !== undefined && interval.unit) {
    const value = Number(interval.value);
    if (!Number.isFinite(value) || value <= 0) {
      return 7 * 24 * 60 * 60 * 1000;
    }
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

async function stopClientFollowUps(clientId) {
  if (!clientId) {
    return 0;
  }

  const activeJobs = await FollowUpJob.findAll({
    where: {
      clientId,
      status: 'active'
    }
  });

  let stoppedCount = 0;

  for (const job of activeJobs) {
    await job.update({
      status: 'stopped',
      paused: false,
      completedAt: new Date()
    });
    stoppedCount += 1;
  }

  return stoppedCount;
}

async function rescheduleConferenceFollowUps(conference) {
  if (!conference) {
    return { updatedCount: 0, pausedCount: 0 };
  }

  const conferenceId = conference.id || conference.conferenceId;
  if (!conferenceId) {
    return { updatedCount: 0, pausedCount: 0 };
  }

  const activeJobs = await FollowUpJob.findAll({
    where: {
      conferenceId,
      status: 'active'
    }
  });

  const { stage1Interval, stage2Interval, stage1MaxAttempts, stage2MaxAttempts, skipWeekends, timezone, workingHours } =
    resolveFollowUpConfig(conference);
  console.log(
    `🔁 Rescheduling jobs for conference ${conferenceId}: ` +
    `Stage1=${stage1Interval.value} ${stage1Interval.unit} (max ${stage1MaxAttempts}), ` +
    `Stage2=${stage2Interval.value} ${stage2Interval.unit} (max ${stage2MaxAttempts}), skipWeekends=${skipWeekends}`
  );

  const stage1Sequence = getStageTemplateSequence(conference, 'stage1');
  const stage2Sequence = getStageTemplateSequence(conference, 'stage2');

  const stageTemplateMap = {
    abstract_submission: stage1Sequence[0] || conference.stage1TemplateId,
    stage1: stage1Sequence[0] || conference.stage1TemplateId,
    registration: stage2Sequence[0] || conference.stage2TemplateId,
    stage2: stage2Sequence[0] || conference.stage2TemplateId
  };

  let updatedCount = 0;
  let pausedCount = 0;

  for (const job of activeJobs) {
    const templateId = stageTemplateMap[job.stage] || job.templateId;

    if (!templateId) {
      await job.update({
        status: 'paused',
        paused: true
      });
      pausedCount += 1;
      console.warn(`⚠️ Follow-up job ${job.id} paused because conference ${conferenceId} has no template for stage ${job.stage}`);
      continue;
    }

    const updatePayload = {
      templateId,
      status: 'active',
      paused: false
    };

    let intervalConfig = null;
    let maxStageAttempts = job.maxAttempts;

    if (job.stage === 'abstract_submission' || job.stage === 'stage1') {
      intervalConfig = stage1Interval;
      maxStageAttempts = stage1MaxAttempts;
    } else if (job.stage === 'registration' || job.stage === 'stage2') {
      intervalConfig = stage2Interval;
      maxStageAttempts = stage2MaxAttempts;
    }

    if (intervalConfig) {
      const nextSendDate = calculateNextSendDate(intervalConfig, skipWeekends);
      updatePayload.customInterval = intervalConfig.unit === 'days'
        ? Math.max(1, Math.round(intervalConfig.value))
        : null;
      updatePayload.skipWeekends = skipWeekends;
      updatePayload.scheduledDate = nextSendDate;
      updatePayload.nextSendAt = nextSendDate;
      updatePayload.maxAttempts = maxStageAttempts;
      updatePayload.settings = {
        ...(job.settings || {}),
        intervalConfig,
        skipWeekends,
        timezone,
        workingHours,
        stageTemplateSequence: (job.stage === 'abstract_submission' || job.stage === 'stage1')
          ? stage1Sequence
          : stage2Sequence
      };
    }

    await job.update(updatePayload);
    updatedCount += 1;
  }

  console.log(`🔁 Rescheduled follow-up jobs for conference ${conferenceId}: updated=${updatedCount}, paused=${pausedCount}`);
  return { updatedCount, pausedCount };
}

async function triggerImmediateFollowUpSend(jobId) {
  try {
    const job = await FollowUpJob.findByPk(jobId, {
      include: [
        { model: Client, as: 'client' },
        { model: Conference, as: 'conference' },
        { model: EmailTemplate, as: 'template' }
      ]
    });

    if (!job) {
      console.warn(`⚠️ Immediate send skipped: follow-up job ${jobId} not found`);
      return;
    }

    await immediateEmailScheduler.sendFollowUpEmail(job);
  } catch (error) {
    console.error(`❌ Failed immediate follow-up send for job ${jobId}:`, error.message);
  }
}

// Function to create default email templates
async function createDefaultTemplates(conferenceId) {
  try {
    const defaultTemplates = [
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
    // Get all conferences for dropdown validation
    const conferences = await Conference.findAll({
      attributes: ['id', 'name'],
      order: [['name', 'ASC']]
    });
    
    // Create template data with example row
    const templateData = [
      {
        'Name': 'John Doe',
        'Email': 'john.doe@example.com',
        'Country': 'USA',
        'Conference': conferences.length > 0 ? conferences[0].name : 'Select Conference',
        'Status': 'Lead',
        'Stage': 'stage1',
        'Emails Already Sent': 0,
        'Stage 1 Emails Already Sent': 0,
        'Stage 2 Emails Already Sent': 0,
        'Notes': 'Example client'
      }
    ];
    
    // Create worksheet
    const worksheet = XLSX.utils.json_to_sheet(templateData);
    
    // Set column widths
    worksheet['!cols'] = [
      { wch: 25 }, // Name
      { wch: 25 }, // Email
      { wch: 15 }, // Country
      { wch: 25 }, // Conference
      { wch: 20 }, // Status
      { wch: 15 }, // Stage
      { wch: 20 }, // Emails Already Sent (legacy stage 1)
      { wch: 24 }, // Stage 1 Emails Already Sent
      { wch: 24 }, // Stage 2 Emails Already Sent
      { wch: 30 }  // Notes
    ];
    
    // Add data validation for dropdowns
    const statusOptions = ['Lead', 'Abstract Submitted', 'Registered', 'Unresponsive', 'Registration Unresponsive'];
    const stageOptions = ['stage1', 'stage2', 'completed'];
    const conferenceNames = conferences.map(c => c.name);
    
    // Create a second sheet with instructions
    const instructions = [
      ['Conference CRM - Bulk Client Upload Template'],
      [''],
      ['Instructions:'],
      ['1. Fill in client details in the "Clients" sheet'],
      ['2. REQUIRED fields: Name, Email'],
      ['3. OPTIONAL fields: Conference, Status, Stage, Emails Already Sent, Stage 1 Emails Already Sent, Stage 2 Emails Already Sent, Country, Notes'],
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
      ['- Use "Emails Already Sent" (Stage 1) or the stage-specific columns to skip already sent follow-ups (e.g., Stage 1 = 3 means automation starts at attempt 4)'],
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
router.post('/bulk-upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    // Handle file upload
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
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
        // Validate REQUIRED: Name+Email OR First+Last+Email
        const csvName = row['Name'] && String(row['Name']).trim();
        const csvFirst = row['First Name'] && String(row['First Name']).trim();
        const csvLast = row['Last Name'] && String(row['Last Name']).trim();
        if ((!csvName && !(csvFirst && csvLast)) || !row['Email']) {
          results.failed++;
          results.errors.push(`Row ${rowNum}: Missing required fields (Name or First+Last, and Email)`);
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
        
        // Stage is OPTIONAL - default to 'stage1'
        const validStages = ['stage1', 'stage2', 'completed'];
        const stage = row['Stage'] || 'stage1';
        if (!validStages.includes(stage)) {
          results.failed++;
          results.errors.push(`Row ${rowNum}: Invalid stage "${stage}". Valid options: ${validStages.join(', ')}`);
          continue;
        }
        
        // Parse manualEmailsCount (optional, default 0)
        const manualEmailsCount = sanitizeNonNegativeInt(row['Emails Already Sent']);
        const stage1CsvCount = row['Stage 1 Emails Already Sent'];
        const stage2CsvCount = row['Stage 2 Emails Already Sent'];
        const manualStage1Count = Object.prototype.hasOwnProperty.call(row, 'Stage 1 Emails Already Sent')
          ? sanitizeNonNegativeInt(stage1CsvCount)
          : manualEmailsCount;
        const manualStage2Count = Object.prototype.hasOwnProperty.call(row, 'Stage 2 Emails Already Sent')
          ? sanitizeNonNegativeInt(stage2CsvCount)
          : 0;
        
        // Create client with all optional fields
        const client = await Client.create({
          name: csvName || `${csvFirst || ''} ${csvLast || ''}`.trim(),
          email: row['Email'],
          country: row['Country'] || null,
          status: status,
          conferenceId: conferenceId || null,
          currentStage: stage,
          manualEmailsCount: manualStage1Count,
          manualStage1Count,
          manualStage2Count,
          notes: row['Notes'] || null,
          organizationId: req.user.organizationId || null,
          // Ensure visibility: set owner to uploader by default
          ownerUserId: req.user.id
        });
        await applyBaselineToClientEngagement(client);
        
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
    
  } catch (error) {
    console.error('Error in bulk upload:', error);
    res.status(500).json({ error: 'Bulk upload failed', details: error.message });
  }
});

// Mount client note routes under /api/clients
router.use('/', clientNoteRoutes);

// Export router and workflow function
module.exports = router;
module.exports.startAutomaticEmailWorkflow = startAutomaticEmailWorkflow;
module.exports.stopClientFollowUps = stopClientFollowUps;
module.exports.rescheduleConferenceFollowUps = rescheduleConferenceFollowUps;
