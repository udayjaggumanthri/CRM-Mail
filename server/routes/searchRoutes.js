const express = require('express');
const { Op } = require('sequelize');
const { 
  Client, Conference, Email, EmailTemplate, User, 
  ClientNote, Task, FollowUpJob, EmailLog, SearchPreset 
} = require('../models');
const router = express.Router();

// Middleware for authentication
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  const jwt = require('jsonwebtoken');
  const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Helper: Check if user has access to conference
async function checkConferenceAccess(conferenceId, userId, userRole) {
  if (userRole === 'CEO') return true;
  
  const conference = await Conference.findByPk(conferenceId);
  if (!conference) return false;
  
  if (userRole === 'TeamLead') {
    return conference.assignedTeamLeadId === userId;
  } else if (userRole === 'Member') {
    const assignedMemberIds = conference.assignedMemberIds || [];
    return assignedMemberIds.includes(userId);
  }
  
  return false;
}

// Helper: Check if user has access to client
async function checkClientAccess(clientId, userId, userRole) {
  if (userRole === 'CEO') return true;
  
  const client = await Client.findByPk(clientId);
  if (!client || !client.conferenceId) return false;
  
  return await checkConferenceAccess(client.conferenceId, userId, userRole);
}

// POST /api/search/global - Global search across all entities
router.post('/global', authenticateToken, async (req, res) => {
  try {
    const { 
      query, 
      entities = ['clients', 'conferences', 'emails', 'users', 'notes', 'tasks'],
      filters = {},
      limit = 20,
      offset = 0
    } = req.body;

    if (!query || !query.trim()) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const searchTerm = query.trim();
    const results = {
      clients: [],
      conferences: [],
      emails: [],
      users: [],
      notes: [],
      tasks: [],
      totalResults: 0,
      query: searchTerm
    };

    // Search Clients
    if (entities.includes('clients')) {
      const clientWhereClause = {
        organizationId: req.user.organizationId,
        [Op.or]: [
          { firstName: { [Op.iLike]: `%${searchTerm}%` } },
          { lastName: { [Op.iLike]: `%${searchTerm}%` } },
          { email: { [Op.iLike]: `%${searchTerm}%` } },
          { organization: { [Op.iLike]: `%${searchTerm}%` } },
          { phone: { [Op.iLike]: `%${searchTerm}%` } },
          { country: { [Op.iLike]: `%${searchTerm}%` } }
        ]
      };

      // Apply additional filters
      if (filters.clientStatus) {
        clientWhereClause.status = filters.clientStatus;
      }
      if (filters.clientCountry) {
        clientWhereClause.country = filters.clientCountry;
      }
      if (filters.conferenceId) {
        clientWhereClause.conferenceId = filters.conferenceId;
      }

      const clients = await Client.findAll({
        where: clientWhereClause,
        include: [
          {
            model: Conference,
            as: 'conference',
            attributes: ['id', 'name', 'startDate', 'endDate']
          },
          {
            model: User,
            as: 'owner',
            attributes: ['id', 'name', 'email']
          }
        ],
        limit: Math.min(limit, 50),
        offset,
        order: [['createdAt', 'DESC']]
      });

      // Filter clients by access permissions
      const accessibleClients = [];
      for (const client of clients) {
        const hasAccess = await checkClientAccess(client.id, req.user.id, req.user.role);
        if (hasAccess) {
          accessibleClients.push({
            ...client.toJSON(),
            entityType: 'client',
            searchScore: calculateSearchScore(client, searchTerm)
          });
        }
      }

      results.clients = accessibleClients;
    }

    // Search Conferences
    if (entities.includes('conferences')) {
      const conferenceWhereClause = {
        organizationId: req.user.organizationId,
        [Op.or]: [
          { name: { [Op.iLike]: `%${searchTerm}%` } },
          { description: { [Op.iLike]: `%${searchTerm}%` } },
          { location: { [Op.iLike]: `%${searchTerm}%` } },
          { venue: { [Op.iLike]: `%${searchTerm}%` } }
        ]
      };

      // Apply additional filters
      if (filters.conferenceStatus) {
        conferenceWhereClause.status = filters.conferenceStatus;
      }
      if (filters.conferenceYear) {
        conferenceWhereClause.startDate = {
          [Op.between]: [
            new Date(`${filters.conferenceYear}-01-01`),
            new Date(`${filters.conferenceYear}-12-31`)
          ]
        };
      }

      const conferences = await Conference.findAll({
        where: conferenceWhereClause,
        include: [
          {
            model: User,
            as: 'primaryContact',
            attributes: ['id', 'name', 'email']
          }
        ],
        limit: Math.min(limit, 50),
        offset,
        order: [['startDate', 'DESC']]
      });

      // Filter conferences by access permissions
      const accessibleConferences = [];
      for (const conference of conferences) {
        const hasAccess = await checkConferenceAccess(conference.id, req.user.id, req.user.role);
        if (hasAccess) {
          accessibleConferences.push({
            ...conference.toJSON(),
            entityType: 'conference',
            searchScore: calculateSearchScore(conference, searchTerm)
          });
        }
      }

      results.conferences = accessibleConferences;
    }

    // Search Emails
    if (entities.includes('emails')) {
      const emailWhereClause = {
        organizationId: req.user.organizationId,
        [Op.or]: [
          { subject: { [Op.iLike]: `%${searchTerm}%` } },
          { from: { [Op.iLike]: `%${searchTerm}%` } },
          { to: { [Op.iLike]: `%${searchTerm}%` } },
          { body: { [Op.iLike]: `%${searchTerm}%` } }
        ]
      };

      // Apply additional filters
      if (filters.emailFolder) {
        emailWhereClause.folder = filters.emailFolder;
      }
      if (filters.emailDateFrom) {
        emailWhereClause.date = {
          ...emailWhereClause.date,
          [Op.gte]: new Date(filters.emailDateFrom)
        };
      }
      if (filters.emailDateTo) {
        emailWhereClause.date = {
          ...emailWhereClause.date,
          [Op.lte]: new Date(filters.emailDateTo)
        };
      }

      const emails = await Email.findAll({
        where: emailWhereClause,
        include: [
          {
            model: Client,
            as: 'client',
            attributes: ['id', 'firstName', 'lastName', 'email']
          }
        ],
        limit: Math.min(limit, 50),
        offset,
        order: [['date', 'DESC']]
      });

      results.emails = emails.map(email => ({
        ...email.toJSON(),
        entityType: 'email',
        searchScore: calculateSearchScore(email, searchTerm)
      }));
    }

    // Search Users
    if (entities.includes('users') && req.user.role === 'CEO') {
      const userWhereClause = {
        organizationId: req.user.organizationId,
        [Op.or]: [
          { name: { [Op.iLike]: `%${searchTerm}%` } },
          { email: { [Op.iLike]: `%${searchTerm}%` } }
        ]
      };

      // Apply additional filters
      if (filters.userRole) {
        userWhereClause.role = filters.userRole;
      }

      const users = await User.findAll({
        where: userWhereClause,
        include: [
          {
            model: User,
            as: 'manager',
            attributes: ['id', 'name', 'email']
          }
        ],
        limit: Math.min(limit, 50),
        offset,
        order: [['name', 'ASC']]
      });

      results.users = users.map(user => ({
        ...user.toJSON(),
        entityType: 'user',
        searchScore: calculateSearchScore(user, searchTerm)
      }));
    }

    // Search Client Notes
    if (entities.includes('notes')) {
      const noteWhereClause = {
        organizationId: req.user.organizationId,
        isDeleted: false,
        [Op.or]: [
          { content: { [Op.iLike]: `%${searchTerm}%` } },
          { title: { [Op.iLike]: `%${searchTerm}%` } }
        ]
      };

      // Apply additional filters
      if (filters.noteType) {
        noteWhereClause.type = filters.noteType;
      }
      if (filters.notePriority) {
        noteWhereClause.priority = filters.notePriority;
      }

      const notes = await ClientNote.findAll({
        where: noteWhereClause,
        include: [
          {
            model: Client,
            as: 'client',
            attributes: ['id', 'firstName', 'lastName', 'email']
          },
          {
            model: User,
            as: 'author',
            attributes: ['id', 'name', 'email']
          }
        ],
        limit: Math.min(limit, 50),
        offset,
        order: [['createdAt', 'DESC']]
      });

      // Filter notes by client access permissions
      const accessibleNotes = [];
      for (const note of notes) {
        const hasAccess = await checkClientAccess(note.clientId, req.user.id, req.user.role);
        if (hasAccess) {
          accessibleNotes.push({
            ...note.toJSON(),
            entityType: 'note',
            searchScore: calculateSearchScore(note, searchTerm)
          });
        }
      }

      results.notes = accessibleNotes;
    }

    // Search Tasks
    if (entities.includes('tasks')) {
      const taskWhereClause = {
        organizationId: req.user.organizationId,
        isDeleted: false,
        [Op.or]: [
          { title: { [Op.iLike]: `%${searchTerm}%` } },
          { description: { [Op.iLike]: `%${searchTerm}%` } },
          { notes: { [Op.iLike]: `%${searchTerm}%` } }
        ]
      };

      // Apply additional filters
      if (filters.taskStatus) {
        taskWhereClause.status = filters.taskStatus;
      }
      if (filters.taskPriority) {
        taskWhereClause.priority = filters.taskPriority;
      }
      if (filters.taskAssignedTo) {
        taskWhereClause.assignedToId = filters.taskAssignedTo;
      }

      const tasks = await Task.findAll({
        where: taskWhereClause,
        include: [
          {
            model: User,
            as: 'assignedTo',
            attributes: ['id', 'name', 'email']
          },
          {
            model: User,
            as: 'assignedBy',
            attributes: ['id', 'name', 'email']
          }
        ],
        limit: Math.min(limit, 50),
        offset,
        order: [['createdAt', 'DESC']]
      });

      // Filter tasks by access permissions
      const accessibleTasks = [];
      for (const task of tasks) {
        const canView = req.user.role === 'CEO' || 
                       task.assignedToId === req.user.id || 
                       task.assignedById === req.user.id;
        
        if (canView) {
          accessibleTasks.push({
            ...task.toJSON(),
            entityType: 'task',
            searchScore: calculateSearchScore(task, searchTerm)
          });
        }
      }

      results.tasks = accessibleTasks;
    }

    // Calculate total results
    results.totalResults = 
      results.clients.length + 
      results.conferences.length + 
      results.emails.length + 
      results.users.length + 
      results.notes.length + 
      results.tasks.length;

    console.log(`🔍 Global search for "${searchTerm}" returned ${results.totalResults} results`);

    res.json(results);
  } catch (error) {
    console.error('Error in global search:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper function to calculate search relevance score
function calculateSearchScore(entity, searchTerm) {
  const term = searchTerm.toLowerCase();
  let score = 0;
  
  // Check each field and assign scores based on relevance
  Object.keys(entity).forEach(key => {
    if (typeof entity[key] === 'string') {
      const value = entity[key].toLowerCase();
      
      // Exact match gets highest score
      if (value === term) {
        score += 100;
      }
      // Starts with search term gets high score
      else if (value.startsWith(term)) {
        score += 50;
      }
      // Contains search term gets medium score
      else if (value.includes(term)) {
        score += 25;
      }
      
      // Field-specific bonuses
      if (key === 'firstName' || key === 'lastName' || key === 'name' || key === 'title') {
        score += 10;
      }
      if (key === 'email') {
        score += 5;
      }
    }
  });
  
  return score;
}

// POST /api/search/advanced - Advanced search with complex filters
router.post('/advanced', authenticateToken, async (req, res) => {
  try {
    const {
      query,
      entityType, // 'clients', 'conferences', 'emails', etc.
      filters = {},
      sortBy = 'relevance',
      sortOrder = 'desc',
      limit = 50,
      offset = 0
    } = req.body;

    if (!entityType) {
      return res.status(400).json({ error: 'Entity type is required' });
    }

    let results = [];

    switch (entityType) {
      case 'clients':
        results = await searchClientsAdvanced(req.user, query, filters, sortBy, sortOrder, limit, offset);
        break;
      case 'conferences':
        results = await searchConferencesAdvanced(req.user, query, filters, sortBy, sortOrder, limit, offset);
        break;
      case 'emails':
        results = await searchEmailsAdvanced(req.user, query, filters, sortBy, sortOrder, limit, offset);
        break;
      case 'users':
        results = await searchUsersAdvanced(req.user, query, filters, sortBy, sortOrder, limit, offset);
        break;
      case 'notes':
        results = await searchNotesAdvanced(req.user, query, filters, sortBy, sortOrder, limit, offset);
        break;
      case 'tasks':
        results = await searchTasksAdvanced(req.user, query, filters, sortBy, sortOrder, limit, offset);
        break;
      default:
        return res.status(400).json({ error: 'Invalid entity type' });
    }

    res.json({
      entityType,
      results,
      totalResults: results.length,
      query,
      filters,
      sortBy,
      sortOrder
    });
  } catch (error) {
    console.error('Error in advanced search:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Advanced search functions for each entity type
async function searchClientsAdvanced(user, query, filters, sortBy, sortOrder, limit, offset) {
  const whereClause = {
    organizationId: user.organizationId
  };

  // Add text search
  if (query) {
    whereClause[Op.or] = [
      { firstName: { [Op.iLike]: `%${query}%` } },
      { lastName: { [Op.iLike]: `%${query}%` } },
      { email: { [Op.iLike]: `%${query}%` } },
      { organization: { [Op.iLike]: `%${query}%` } },
      { phone: { [Op.iLike]: `%${query}%` } },
      { country: { [Op.iLike]: `%${query}%` } }
    ];
  }

  // Apply filters
  if (filters.status) whereClause.status = filters.status;
  if (filters.country) whereClause.country = filters.country;
  if (filters.conferenceId) whereClause.conferenceId = filters.conferenceId;
  if (filters.ownerId) whereClause.ownerUserId = filters.ownerId;
  if (filters.createdFrom) {
    whereClause.createdAt = { ...whereClause.createdAt, [Op.gte]: new Date(filters.createdFrom) };
  }
  if (filters.createdTo) {
    whereClause.createdAt = { ...whereClause.createdAt, [Op.lte]: new Date(filters.createdTo) };
  }

  const clients = await Client.findAll({
    where: whereClause,
    include: [
      { model: Conference, as: 'conference', attributes: ['id', 'name', 'startDate'] },
      { model: User, as: 'owner', attributes: ['id', 'name', 'email'] }
    ],
    limit,
    offset,
    order: [[sortBy, sortOrder.toUpperCase()]]
  });

  // Filter by access permissions
  const accessibleClients = [];
  for (const client of clients) {
    const hasAccess = await checkClientAccess(client.id, user.id, user.role);
    if (hasAccess) {
      accessibleClients.push(client);
    }
  }

  return accessibleClients;
}

async function searchConferencesAdvanced(user, query, filters, sortBy, sortOrder, limit, offset) {
  const whereClause = {
    organizationId: user.organizationId
  };

  if (query) {
    whereClause[Op.or] = [
      { name: { [Op.iLike]: `%${query}%` } },
      { description: { [Op.iLike]: `%${query}%` } },
      { location: { [Op.iLike]: `%${query}%` } },
      { venue: { [Op.iLike]: `%${query}%` } }
    ];
  }

  if (filters.status) whereClause.status = filters.status;
  if (filters.year) {
    whereClause.startDate = {
      [Op.between]: [
        new Date(`${filters.year}-01-01`),
        new Date(`${filters.year}-12-31`)
      ]
    };
  }
  if (filters.location) whereClause.location = { [Op.iLike]: `%${filters.location}%` };

  const conferences = await Conference.findAll({
    where: whereClause,
    include: [
      { model: User, as: 'primaryContact', attributes: ['id', 'name', 'email'] }
    ],
    limit,
    offset,
    order: [[sortBy, sortOrder.toUpperCase()]]
  });

  // Filter by access permissions
  const accessibleConferences = [];
  for (const conference of conferences) {
    const hasAccess = await checkConferenceAccess(conference.id, user.id, user.role);
    if (hasAccess) {
      accessibleConferences.push(conference);
    }
  }

  return accessibleConferences;
}

async function searchEmailsAdvanced(user, query, filters, sortBy, sortOrder, limit, offset) {
  const whereClause = {
    organizationId: user.organizationId
  };

  if (query) {
    whereClause[Op.or] = [
      { subject: { [Op.iLike]: `%${query}%` } },
      { from: { [Op.iLike]: `%${query}%` } },
      { to: { [Op.iLike]: `%${query}%` } },
      { body: { [Op.iLike]: `%${query}%` } }
    ];
  }

  if (filters.folder) whereClause.folder = filters.folder;
  if (filters.dateFrom) {
    whereClause.date = { ...whereClause.date, [Op.gte]: new Date(filters.dateFrom) };
  }
  if (filters.dateTo) {
    whereClause.date = { ...whereClause.date, [Op.lte]: new Date(filters.dateTo) };
  }
  if (filters.from) whereClause.from = { [Op.iLike]: `%${filters.from}%` };
  if (filters.to) whereClause.to = { [Op.iLike]: `%${filters.to}%` };

  return await Email.findAll({
    where: whereClause,
    include: [
      { model: Client, as: 'client', attributes: ['id', 'firstName', 'lastName', 'email'] }
    ],
    limit,
    offset,
    order: [[sortBy, sortOrder.toUpperCase()]]
  });
}

async function searchUsersAdvanced(user, query, filters, sortBy, sortOrder, limit, offset) {
  if (user.role !== 'CEO') {
    return [];
  }

  const whereClause = {
    organizationId: user.organizationId
  };

  if (query) {
    whereClause[Op.or] = [
      { name: { [Op.iLike]: `%${query}%` } },
      { email: { [Op.iLike]: `%${query}%` } }
    ];
  }

  if (filters.role) whereClause.role = filters.role;
  if (filters.isActive !== undefined) whereClause.isActive = filters.isActive;

  return await User.findAll({
    where: whereClause,
    include: [
      { model: User, as: 'manager', attributes: ['id', 'name', 'email'] }
    ],
    limit,
    offset,
    order: [[sortBy, sortOrder.toUpperCase()]]
  });
}

async function searchNotesAdvanced(user, query, filters, sortBy, sortOrder, limit, offset) {
  const whereClause = {
    organizationId: user.organizationId,
    isDeleted: false
  };

  if (query) {
    whereClause[Op.or] = [
      { content: { [Op.iLike]: `%${query}%` } },
      { title: { [Op.iLike]: `%${query}%` } }
    ];
  }

  if (filters.type) whereClause.type = filters.type;
  if (filters.priority) whereClause.priority = filters.priority;
  if (filters.authorId) whereClause.authorId = filters.authorId;
  if (filters.isPrivate !== undefined) whereClause.isPrivate = filters.isPrivate;

  const notes = await ClientNote.findAll({
    where: whereClause,
    include: [
      { model: Client, as: 'client', attributes: ['id', 'firstName', 'lastName', 'email'] },
      { model: User, as: 'author', attributes: ['id', 'name', 'email'] }
    ],
    limit,
    offset,
    order: [[sortBy, sortOrder.toUpperCase()]]
  });

  // Filter by client access permissions
  const accessibleNotes = [];
  for (const note of notes) {
    const hasAccess = await checkClientAccess(note.clientId, user.id, user.role);
    if (hasAccess) {
      accessibleNotes.push(note);
    }
  }

  return accessibleNotes;
}

async function searchTasksAdvanced(user, query, filters, sortBy, sortOrder, limit, offset) {
  const whereClause = {
    organizationId: user.organizationId,
    isDeleted: false
  };

  if (query) {
    whereClause[Op.or] = [
      { title: { [Op.iLike]: `%${query}%` } },
      { description: { [Op.iLike]: `%${query}%` } },
      { notes: { [Op.iLike]: `%${query}%` } }
    ];
  }

  if (filters.status) whereClause.status = filters.status;
  if (filters.priority) whereClause.priority = filters.priority;
  if (filters.assignedToId) whereClause.assignedToId = filters.assignedToId;
  if (filters.assignedById) whereClause.assignedById = filters.assignedById;
  if (filters.dueFrom) {
    whereClause.dueDate = { ...whereClause.dueDate, [Op.gte]: new Date(filters.dueFrom) };
  }
  if (filters.dueTo) {
    whereClause.dueDate = { ...whereClause.dueDate, [Op.lte]: new Date(filters.dueTo) };
  }

  const tasks = await Task.findAll({
    where: whereClause,
    include: [
      { model: User, as: 'assignedTo', attributes: ['id', 'name', 'email'] },
      { model: User, as: 'assignedBy', attributes: ['id', 'name', 'email'] }
    ],
    limit,
    offset,
    order: [[sortBy, sortOrder.toUpperCase()]]
  });

  // Filter by access permissions
  const accessibleTasks = [];
  for (const task of tasks) {
    const canView = user.role === 'CEO' || 
                   task.assignedToId === user.id || 
                   task.assignedById === user.id;
    
    if (canView) {
      accessibleTasks.push(task);
    }
  }

  return accessibleTasks;
}

// GET /api/search/presets - Get user's search presets
router.get('/presets', authenticateToken, async (req, res) => {
  try {
    const { entityType, includePublic = 'false' } = req.query;

    const whereClause = {
      organizationId: req.user.organizationId,
      isDeleted: false
    };

    // Include user's own presets
    whereClause[Op.or] = [
      { userId: req.user.id }
    ];

    // Include public presets if requested
    if (includePublic === 'true') {
      whereClause[Op.or].push({ isPublic: true });
    }

    // Filter by entity type
    if (entityType) {
      whereClause.entityType = entityType;
    }

    const presets = await SearchPreset.findAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email']
        }
      ],
      order: [
        ['usageCount', 'DESC'],
        ['lastUsedAt', 'DESC'],
        ['createdAt', 'DESC']
      ]
    });

    res.json(presets);
  } catch (error) {
    console.error('Error fetching search presets:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/search/presets - Create new search preset
router.post('/presets', authenticateToken, async (req, res) => {
  try {
    const {
      name,
      description,
      entityType,
      query,
      filters = {},
      sortBy = 'createdAt',
      sortOrder = 'desc',
      limit = 50,
      isPublic = false
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Preset name is required' });
    }

    if (!entityType) {
      return res.status(400).json({ error: 'Entity type is required' });
    }

    // Check if preset name already exists for this user
    const existingPreset = await SearchPreset.findOne({
      where: {
        userId: req.user.id,
        name: name.trim(),
        isDeleted: false
      }
    });

    if (existingPreset) {
      return res.status(400).json({ error: 'A preset with this name already exists' });
    }

    const preset = await SearchPreset.create({
      userId: req.user.id,
      name: name.trim(),
      description,
      entityType,
      query,
      filters,
      sortBy,
      sortOrder,
      limit,
      isPublic,
      organizationId: req.user.organizationId
    });

    const presetWithUser = await SearchPreset.findByPk(preset.id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email']
        }
      ]
    });

    console.log(`✅ Search preset "${name}" created by ${req.user.email}`);

    res.status(201).json({
      message: 'Search preset created successfully',
      preset: presetWithUser
    });
  } catch (error) {
    console.error('Error creating search preset:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/search/presets/:id - Update search preset
router.put('/presets/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      query,
      filters,
      sortBy,
      sortOrder,
      limit,
      isPublic
    } = req.body;

    const preset = await SearchPreset.findOne({
      where: {
        id,
        userId: req.user.id,
        isDeleted: false
      }
    });

    if (!preset) {
      return res.status(404).json({ error: 'Preset not found' });
    }

    // Check if new name conflicts with existing preset
    if (name && name !== preset.name) {
      const existingPreset = await SearchPreset.findOne({
        where: {
          userId: req.user.id,
          name: name.trim(),
          isDeleted: false,
          id: { [Op.ne]: id }
        }
      });

      if (existingPreset) {
        return res.status(400).json({ error: 'A preset with this name already exists' });
      }
    }

    const updateData = {};
    if (name) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description;
    if (query !== undefined) updateData.query = query;
    if (filters) updateData.filters = filters;
    if (sortBy) updateData.sortBy = sortBy;
    if (sortOrder) updateData.sortOrder = sortOrder;
    if (limit) updateData.limit = limit;
    if (isPublic !== undefined) updateData.isPublic = isPublic;

    await preset.update(updateData);

    const updatedPreset = await SearchPreset.findByPk(preset.id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email']
        }
      ]
    });

    console.log(`✅ Search preset ${id} updated by ${req.user.email}`);

    res.json({
      message: 'Search preset updated successfully',
      preset: updatedPreset
    });
  } catch (error) {
    console.error('Error updating search preset:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/search/presets/:id - Delete search preset
router.delete('/presets/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const preset = await SearchPreset.findOne({
      where: {
        id,
        userId: req.user.id,
        isDeleted: false
      }
    });

    if (!preset) {
      return res.status(404).json({ error: 'Preset not found' });
    }

    // Soft delete
    await preset.update({ isDeleted: true });

    console.log(`🗑️ Search preset ${id} deleted by ${req.user.email}`);

    res.json({ message: 'Search preset deleted successfully' });
  } catch (error) {
    console.error('Error deleting search preset:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/search/presets/:id/use - Use search preset and increment usage count
router.post('/presets/:id/use', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const preset = await SearchPreset.findOne({
      where: {
        id,
        organizationId: req.user.organizationId,
        isDeleted: false
      }
    });

    if (!preset) {
      return res.status(404).json({ error: 'Preset not found' });
    }

    // Increment usage count and update last used
    await preset.update({
      usageCount: preset.usageCount + 1,
      lastUsedAt: new Date()
    });

    console.log(`📊 Search preset ${id} used by ${req.user.email}`);

    res.json({
      message: 'Preset usage recorded',
      preset: {
        id: preset.id,
        name: preset.name,
        entityType: preset.entityType,
        query: preset.query,
        filters: preset.filters,
        sortBy: preset.sortBy,
        sortOrder: preset.sortOrder,
        limit: preset.limit
      }
    });
  } catch (error) {
    console.error('Error using search preset:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/search/export - Export search results
router.post('/export', authenticateToken, async (req, res) => {
  try {
    const {
      query,
      entityType,
      filters = {},
      format = 'csv' // csv, json, xlsx
    } = req.body;

    if (!entityType) {
      return res.status(400).json({ error: 'Entity type is required' });
    }

    // Get search results using advanced search
    const results = await getSearchResultsForExport(req.user, query, entityType, filters);

    if (format === 'csv') {
      const csv = convertToCSV(results, entityType);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="search-results-${entityType}-${Date.now()}.csv"`);
      res.send(csv);
    } else if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="search-results-${entityType}-${Date.now()}.json"`);
      res.json(results);
    } else if (format === 'xlsx') {
      const XLSX = require('xlsx');
      const worksheet = XLSX.utils.json_to_sheet(results);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Search Results');
      
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="search-results-${entityType}-${Date.now()}.xlsx"`);
      res.send(buffer);
    } else {
      return res.status(400).json({ error: 'Invalid export format' });
    }

    console.log(`📤 Search results exported for ${req.user.email}: ${results.length} ${entityType} records`);
  } catch (error) {
    console.error('Error exporting search results:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper function to get search results for export
async function getSearchResultsForExport(user, query, entityType, filters) {
  switch (entityType) {
    case 'clients':
      return await searchClientsAdvanced(user, query, filters, 'createdAt', 'desc', 10000, 0);
    case 'conferences':
      return await searchConferencesAdvanced(user, query, filters, 'startDate', 'desc', 10000, 0);
    case 'emails':
      return await searchEmailsAdvanced(user, query, filters, 'date', 'desc', 10000, 0);
    case 'users':
      return await searchUsersAdvanced(user, query, filters, 'name', 'asc', 10000, 0);
    case 'notes':
      return await searchNotesAdvanced(user, query, filters, 'createdAt', 'desc', 10000, 0);
    case 'tasks':
      return await searchTasksAdvanced(user, query, filters, 'createdAt', 'desc', 10000, 0);
    default:
      return [];
  }
}

// Helper function to convert results to CSV
function convertToCSV(results, entityType) {
  if (results.length === 0) {
    return 'No results found';
  }

  const headers = Object.keys(results[0].dataValues || results[0]);
  const csvRows = [headers.join(',')];

  results.forEach(result => {
    const values = headers.map(header => {
      const value = result[header];
      if (value === null || value === undefined) return '';
      if (typeof value === 'object') return JSON.stringify(value);
      return `"${String(value).replace(/"/g, '""')}"`;
    });
    csvRows.push(values.join(','));
  });

  return csvRows.join('\n');
}

module.exports = router;
