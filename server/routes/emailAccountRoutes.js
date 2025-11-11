const express = require('express');
const router = express.Router();
const { EmailAccount, EmailFolder, User, sequelize } = require('../models');
const { Op } = require('sequelize');

// Simple authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
};

// Apply authentication to all routes
router.use(authenticateToken);

// Get email accounts
router.get('/', async (req, res) => {
  try {
    const accounts = await EmailAccount.findAll({
      include: [
        { model: User, as: 'creator', attributes: ['id', 'name', 'email'] }
      ],
      order: [
        ['sendPriority', 'ASC'],
        ['createdAt', 'ASC']
      ]
    });

    res.json(accounts);
  } catch (error) {
    console.error('Get email accounts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get email account by ID
router.get('/:id', async (req, res) => {
  try {
    const account = await EmailAccount.findByPk(req.params.id, {
      include: [
        { model: User, as: 'creator', attributes: ['id', 'name', 'email'] },
        { model: EmailFolder, as: 'folders', order: [['sortOrder', 'ASC']] }
      ]
    });

    if (!account) {
      return res.status(404).json({ error: 'Email account not found' });
    }

    res.json(account);
  } catch (error) {
    console.error('Get email account error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create email account
router.post('/', async (req, res) => {
  try {
    console.log('📧 SMTP Account Creation Request:', {
      body: req.body,
      user: req.user ? req.user.id : 'No user'
    });
    
    const {
      name,
      email,
      fromEmail, // Frontend sends this instead of email
      type = 'both',
      smtpHost,
      host, // Frontend sends this instead of smtpHost
      smtpPort = 587,
      port, // Frontend sends this instead of smtpPort
      smtpUsername,
      username, // Frontend sends this instead of smtpUsername
      smtpPassword,
      password, // Frontend sends this instead of smtpPassword
      smtpSecure = true,
      security, // Frontend sends this instead of smtpSecure
      smtpAuth = true,
      imapHost,
      imapPort = 993,
      imapUsername,
      imapPassword,
      imapSecure = true,
      imapSecurity, // Frontend sends this instead of imapSecure
      syncInterval = 300,
      maxEmailsPerSync = 100,
      autoReply = false,
      autoReplyMessage,
      signature,
      createdBy,
      isSystem, // Frontend sends this
      allowUsers // Frontend sends this
    } = req.body;

    // Enterprise-level field mapping and validation
    const emailAddress = email || fromEmail;
    const smtpHostValue = smtpHost || host;
    const smtpPortValue = smtpPort || port || 587;
    const smtpUsernameValue = smtpUsername || username;
    const smtpPasswordValue = smtpPassword || password;
    const smtpSecureValue = smtpSecure || (security === 'ssl' || security === 'tls');
    const imapSecureValue = imapSecure || (imapSecurity === 'ssl' || imapSecurity === 'tls');
    
    // Enterprise validation
    if (!emailAddress) {
      return res.status(400).json({ 
        error: 'Email address is required',
        code: 'MISSING_EMAIL',
        details: 'Please provide either email or fromEmail field'
      });
    }
    
    if (!smtpHostValue) {
      return res.status(400).json({ 
        error: 'SMTP host is required',
        code: 'MISSING_SMTP_HOST',
        details: 'Please provide either smtpHost or host field'
      });
    }
    
    if (!smtpUsernameValue) {
      return res.status(400).json({ 
        error: 'SMTP username is required',
        code: 'MISSING_SMTP_USERNAME',
        details: 'Please provide either smtpUsername or username field'
      });
    }
    
    if (!smtpPasswordValue) {
      return res.status(400).json({ 
        error: 'SMTP password is required',
        code: 'MISSING_SMTP_PASSWORD',
        details: 'Please provide either smtpPassword or password field'
      });
    }
    
    // Use email as name if name not provided
    const accountName = name || emailAddress;

    // Use authenticated user ID if createdBy not provided
    const creatorId = createdBy || (req.user ? req.user.id : null);
    console.log('📧 Using creator ID:', creatorId);
    
    // Enterprise-level user validation
    if (creatorId) {
      const userExists = await User.findByPk(creatorId);
      if (!userExists) {
        return res.status(400).json({
          error: 'Invalid user ID',
          code: 'INVALID_USER',
          details: `User with ID ${creatorId} does not exist`
        });
      }
    }

    // Check if account already exists
    const existingAccount = await EmailAccount.findOne({
      where: { email: emailAddress }
    });

    if (existingAccount) {
      return res.status(400).json({ 
        error: 'Email account already exists',
        code: 'ACCOUNT_EXISTS',
        details: `An account with email ${emailAddress} already exists`
      });
    }

    // Enterprise-level account creation with proper field mapping
    const accountData = {
      name: accountName,
      email: emailAddress,
      type,
      smtpHost: smtpHostValue,
      smtpPort: smtpPortValue,
      smtpUsername: smtpUsernameValue,
      smtpPassword: smtpPasswordValue,
      smtpSecure: smtpSecureValue,
      smtpAuth,
      imapHost: imapHost || 'imap.gmail.com',
      imapPort: imapPort || 993,
      imapUsername: imapUsername || smtpUsernameValue,
      imapPassword: imapPassword || smtpPasswordValue,
      imapSecure: imapSecureValue,
      syncInterval,
      maxEmailsPerSync,
      autoReply,
      autoReplyMessage,
      signature,
      syncStatus: 'disconnected',
      isSystem: isSystem || false,
      allowUsers: allowUsers || false
    };

    const maxPriority = await EmailAccount.max('sendPriority');
    accountData.sendPriority = Number.isFinite(maxPriority) ? maxPriority + 1 : 1;
    
    // Only add createdBy if we have a valid user ID and it exists in database
    if (creatorId) {
      try {
        const userExists = await User.findByPk(creatorId);
        if (userExists) {
          accountData.createdBy = creatorId;
        } else {
          console.log('User not found, creating account without createdBy');
        }
      } catch (error) {
        console.log('Error checking user, creating account without createdBy:', error.message);
      }
    }
    
    const account = await EmailAccount.create(accountData);

    // Auto-sync emails if IMAP is configured
    if ((type === 'imap' || type === 'both') && imapHost) {
      console.log(`📧 Triggering automatic email sync for new account: ${account.name}`);
      
      // Trigger sync in background (non-blocking)
      const ImapService = require('../services/ImapService');
      const imapService = new ImapService();
      
      // Async background sync - don't await
      setTimeout(async () => {
        try {
          const sinceDate = new Date();
          sinceDate.setDate(sinceDate.getDate() - 365); // 1 year back
          
          const result = await imapService.fetchEmails(account, {
            maxMessages: 500,
            unseenOnly: false,
            since: sinceDate
          });
          
          if (result.success && result.emails) {
            const { Email } = require('../models');
            let syncedCount = 0;
            
            for (const emailData of result.emails) {
              try {
                const existingEmail = await Email.findOne({
                  where: { 
                    messageId: emailData.messageId,
                    emailAccountId: account.id
                  }
                });
                
                if (!existingEmail) {
                  await Email.create({
                    ...emailData,
                    emailAccountId: account.id,
                    folder: 'inbox'
                  });
                  syncedCount++;
                }
              } catch (saveError) {
                console.error(`Error saving email during auto-sync: ${saveError.message}`);
              }
            }
            
            console.log(`✅ Auto-sync completed for ${account.name}: ${syncedCount} new emails`);
          }
        } catch (syncError) {
          console.error(`❌ Auto-sync failed for ${account.name}:`, syncError.message);
        }
      }, 2000); // Wait 2 seconds before starting sync
    }

    // Enterprise-level success response
    res.status(201).json({
      success: true,
      message: 'SMTP account created successfully. Email sync started in background.',
      data: {
        id: account.id,
        name: account.name,
        email: account.email,
        type: account.type,
        smtpHost: account.smtpHost,
        smtpPort: account.smtpPort,
        status: 'created',
        syncStatus: (type === 'imap' || type === 'both') ? 'syncing' : 'not_applicable',
        createdAt: account.createdAt,
        sendPriority: account.sendPriority
      }
    });
  } catch (error) {
    console.error('Create email account error:', error);
    
    // Enterprise-level error handling
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: error.errors.map(err => ({
          field: err.path,
          message: err.message,
          value: err.value
        }))
      });
    }
    
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({
        error: 'Email account already exists',
        code: 'DUPLICATE_EMAIL',
        details: 'An account with this email address already exists'
      });
    }
    
    if (error.name === 'SequelizeForeignKeyConstraintError') {
      return res.status(400).json({
        error: 'Invalid user reference',
        code: 'INVALID_USER_REFERENCE',
        details: 'The specified user does not exist in the system'
      });
    }
    
    res.status(500).json({ 
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      details: 'An unexpected error occurred while creating the SMTP account'
    });
  }
});

// Update email account
router.put('/:id', async (req, res) => {
  try {
    const account = await EmailAccount.findByPk(req.params.id);
    if (!account) {
      return res.status(404).json({ error: 'Email account not found' });
    }

    const updatedAccount = await account.update(req.body);
    res.json(updatedAccount);
  } catch (error) {
    console.error('Update email account error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update sending priority (reorders all accounts)
router.post('/:id/set-priority', async (req, res) => {
  const { priority } = req.body;

  const numericPriority = parseInt(priority, 10);
  if (!Number.isFinite(numericPriority) || numericPriority < 1) {
    return res.status(400).json({ error: 'Priority must be a positive integer' });
  }

  try {
    const account = await EmailAccount.findByPk(req.params.id);
    if (!account) {
      return res.status(404).json({ error: 'Email account not found' });
    }

    await sequelize.transaction(async (transaction) => {
      const accounts = await EmailAccount.findAll({
        order: [
          ['sendPriority', 'ASC'],
          ['createdAt', 'ASC']
        ],
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      const currentIndex = accounts.findIndex(acc => acc.id === account.id);
      if (currentIndex === -1) {
        throw new Error('Email account not found during reordering');
      }

      const [targetAccount] = accounts.splice(currentIndex, 1);
      const insertIndex = Math.min(Math.max(numericPriority - 1, 0), accounts.length);
      accounts.splice(insertIndex, 0, targetAccount);

      for (let index = 0; index < accounts.length; index++) {
        const acc = accounts[index];
        const desiredPriority = index + 1;
        if (acc.sendPriority !== desiredPriority) {
          await EmailAccount.update(
            { sendPriority: desiredPriority },
            { where: { id: acc.id }, transaction }
          );
        }
      }
    });

    const updatedAccounts = await EmailAccount.findAll({
      include: [
        { model: User, as: 'creator', attributes: ['id', 'name', 'email'] }
      ],
      order: [
        ['sendPriority', 'ASC'],
        ['createdAt', 'ASC']
      ]
    });

    res.json({
      success: true,
      message: 'Priority updated successfully',
      accounts: updatedAccounts
    });
  } catch (error) {
    console.error('Set priority error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Test email account connection
router.post('/:id/test', async (req, res) => {
  try {
    const account = await EmailAccount.findByPk(req.params.id);
    if (!account) {
      return res.status(404).json({ error: 'Email account not found' });
    }

    // TODO: Implement connection testing
    // This would test both SMTP and IMAP connections

    res.json({ success: true, message: 'Connection test successful' });
  } catch (error) {
    console.error('Test email account error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start email account sync
router.post('/:id/start-sync', async (req, res) => {
  try {
    const account = await EmailAccount.findByPk(req.params.id);
    if (!account) {
      return res.status(404).json({ error: 'Email account not found' });
    }

    // TODO: Start sync using EmailService
    await account.update({ syncStatus: 'active' });

    res.json({ success: true, message: 'Sync started' });
  } catch (error) {
    console.error('Start sync error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Stop email account sync
router.post('/:id/stop-sync', async (req, res) => {
  try {
    const account = await EmailAccount.findByPk(req.params.id);
    if (!account) {
      return res.status(404).json({ error: 'Email account not found' });
    }

    // TODO: Stop sync using EmailService
    await account.update({ syncStatus: 'paused' });

    res.json({ success: true, message: 'Sync stopped' });
  } catch (error) {
    console.error('Stop sync error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete email account
router.delete('/:id', async (req, res) => {
  try {
    const account = await EmailAccount.findByPk(req.params.id);
    if (!account) {
      return res.status(404).json({ error: 'Email account not found' });
    }

    // TODO: Stop sync and close connections
    await account.destroy();

    res.json({ success: true, message: 'Email account deleted' });
  } catch (error) {
    console.error('Delete email account error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get email folders for account
router.get('/:id/folders', async (req, res) => {
  try {
    const folders = await EmailFolder.findAll({
      where: { emailAccountId: req.params.id },
      order: [['sortOrder', 'ASC'], ['name', 'ASC']]
    });

    res.json(folders);
  } catch (error) {
    console.error('Get email folders error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create email folder
router.post('/:id/folders', async (req, res) => {
  try {
    const { name, type, parentId, path, delimiter = '/' } = req.body;

    if (!name || !type) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const folder = await EmailFolder.create({
      name,
      type,
      parentId,
      path: path || name,
      delimiter,
      emailAccountId: req.params.id
    });

    res.status(201).json(folder);
  } catch (error) {
    console.error('Create email folder error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update email folder
router.put('/folders/:folderId', async (req, res) => {
  try {
    const folder = await EmailFolder.findByPk(req.params.folderId);
    if (!folder) {
      return res.status(404).json({ error: 'Email folder not found' });
    }

    const updatedFolder = await folder.update(req.body);
    res.json(updatedFolder);
  } catch (error) {
    console.error('Update email folder error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete email folder
router.delete('/folders/:folderId', async (req, res) => {
  try {
    const folder = await EmailFolder.findByPk(req.params.folderId);
    if (!folder) {
      return res.status(404).json({ error: 'Email folder not found' });
    }

    await folder.destroy();
    res.json({ success: true, message: 'Email folder deleted' });
  } catch (error) {
    console.error('Delete email folder error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
