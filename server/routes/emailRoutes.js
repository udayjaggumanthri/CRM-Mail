const express = require('express');
const router = express.Router();
const { Email, EmailAccount, EmailFolder, EmailThread, EmailLog, Client } = require('../models');
const { Op } = require('sequelize');
const nodemailer = require('nodemailer');

// Get emails with advanced filtering
router.get('/', async (req, res) => {
  try {
    const {
      folder = 'inbox',
      search = '',
      filter = 'all',
      sortBy = 'date',
      sortOrder = 'desc',
      page = 1,
      limit = 50,
      accountId,
      fromEmail,
      toEmail,
      startDate,
      endDate
    } = req.query;

    const whereClause = {
      folder: folder === 'all' ? { [Op.ne]: null } : folder
    };

    // Add account filter
    if (accountId) {
      whereClause.emailAccountId = accountId;
    }

    // Add email address filters
    if (fromEmail) {
      whereClause.from = { [Op.iLike]: `%${fromEmail}%` };
    }
    if (toEmail) {
      whereClause.to = { [Op.iLike]: `%${toEmail}%` };
    }

    // Add date range filters
    if (startDate || endDate) {
      whereClause.date = {};
      if (startDate) {
        whereClause.date[Op.gte] = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        whereClause.date[Op.lte] = end;
      }
    }

    // Add general search filter
    if (search) {
      whereClause[Op.or] = [
        { subject: { [Op.iLike]: `%${search}%` } },
        { from: { [Op.iLike]: `%${search}%` } },
        { to: { [Op.iLike]: `%${search}%` } },
        { body: { [Op.iLike]: `%${search}%` } }
      ];
    }

    // Add additional filters
    switch (filter) {
      case 'unread':
        whereClause.isRead = false;
        break;
      case 'important':
        whereClause.isImportant = true;
        break;
      case 'starred':
        whereClause.isStarred = true;
        break;
      case 'attachments':
        whereClause.hasAttachments = true;
        break;
      case 'sent':
        whereClause.isSent = true;
        break;
      case 'drafts':
        whereClause.isDraft = true;
        break;
    }

    // Build order clause
    const orderClause = [];
    switch (sortBy) {
      case 'from':
        orderClause.push(['from', sortOrder]);
        break;
      case 'subject':
        orderClause.push(['subject', sortOrder]);
        break;
      case 'size':
        orderClause.push(['size', sortOrder]);
        break;
      case 'date':
      default:
        orderClause.push(['date', sortOrder]);
        break;
    }

    const offset = (page - 1) * limit;
    const parsedLimit = parseInt(limit);

    const { count, rows: emails } = await Email.findAndCountAll({
      where: whereClause,
      include: [
        { model: EmailAccount, as: 'emailAccount', attributes: ['id', 'name', 'email'] },
        { model: EmailFolder, as: 'emailFolder', attributes: ['id', 'name', 'type'] },
        { model: EmailThread, as: 'thread', attributes: ['id', 'subject'] },
        { model: Client, as: 'client', attributes: ['id', 'firstName', 'lastName', 'email'] }
      ],
      order: orderClause,
      limit: parsedLimit,
      offset: parseInt(offset),
      distinct: true
    });

    res.json({
      emails,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parsedLimit,
        pages: Math.ceil(count / parsedLimit),
        hasMore: offset + emails.length < count
      }
    });
  } catch (error) {
    console.error('Get emails error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get email by ID
router.get('/:id', async (req, res) => {
  try {
    const email = await Email.findByPk(req.params.id, {
      include: [
        { model: EmailAccount, as: 'emailAccount', attributes: ['id', 'name', 'email'] },
        { model: EmailFolder, as: 'emailFolder', attributes: ['id', 'name', 'type'] },
        { model: EmailThread, as: 'thread', attributes: ['id', 'subject'] },
        { model: Client, as: 'client', attributes: ['id', 'firstName', 'lastName', 'email'] },
        { model: EmailLog, as: 'logs', order: [['timestamp', 'DESC']] }
      ]
    });

    if (!email) {
      return res.status(404).json({ error: 'Email not found' });
    }

    res.json(email);
  } catch (error) {
    console.error('Get email error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Send email
router.post('/send', async (req, res) => {
  try {
    const {
      emailAccountId,
      to,
      cc,
      bcc,
      subject,
      body,
      bodyHtml,
      bodyText,
      attachments = [],
      parentId,
      parentType,
      isTracked = false
    } = req.body;

    // Validate required fields
    if (!emailAccountId || !to || !subject) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get email account
    const account = await EmailAccount.findByPk(emailAccountId);
    if (!account) {
      return res.status(404).json({ error: 'Email account not found' });
    }

    // Create email record
    const email = await Email.create({
      emailAccountId,
      from: account.email,
      fromName: account.name,
      to,
      cc,
      bcc,
      subject,
      body: body || bodyText,
      bodyHtml,
      bodyText,
      attachments,
      parentId,
      parentType,
      isTracked,
      isSent: false,
      status: 'draft',
      folder: 'sent',
      date: new Date()
    });

    // Send actual email using nodemailer
    try {
      // Create transporter with proper TLS settings
      const transporter = nodemailer.createTransport({
        host: account.smtpHost,
        port: account.smtpPort,
        secure: account.smtpPort === 465, // true for 465, false for other ports
        requireTLS: account.smtpPort === 587, // require TLS for port 587
        tls: {
          rejectUnauthorized: false
        },
        auth: {
          user: account.smtpUsername,
          pass: account.smtpPassword
        }
      });

      // Prepare email options
      const mailOptions = {
        from: `${account.name} <${account.email}>`,
        to: to,
        subject: subject,
        text: body || bodyText,
        html: bodyHtml || body || bodyText
      };

      // Add CC and BCC if provided
      if (cc) mailOptions.cc = cc;
      if (bcc) mailOptions.bcc = bcc;

      // Send email
      const info = await transporter.sendMail(mailOptions);
      
      // Update email record with success
      await email.update({
        isSent: true,
        status: 'sent',
        messageId: info.messageId
      });

      console.log('📧 Email sent successfully:', info.messageId);
      
      res.status(201).json({
        ...email.toJSON(),
        isSent: true,
        status: 'sent',
        messageId: info.messageId
      });
      
    } catch (sendError) {
      console.error('📧 Email send failed:', sendError);
      
      // Update email record with failure
      await email.update({
        isSent: false,
        status: 'failed'
      });
      
      res.status(500).json({ 
        error: 'Failed to send email',
        details: sendError.message 
      });
    }
  } catch (error) {
    console.error('Send email error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Mark emails as read
router.put('/mark-read', async (req, res) => {
  try {
    const { emailIds } = req.body;

    if (!emailIds || !Array.isArray(emailIds)) {
      return res.status(400).json({ error: 'Invalid email IDs' });
    }

    await Email.update(
      { isRead: true },
      { where: { id: { [Op.in]: emailIds } } }
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Mark emails as unread
router.put('/mark-unread', async (req, res) => {
  try {
    const { emailIds } = req.body;

    if (!emailIds || !Array.isArray(emailIds)) {
      return res.status(400).json({ error: 'Invalid email IDs' });
    }

    await Email.update(
      { isRead: false },
      { where: { id: { [Op.in]: emailIds } } }
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Mark as unread error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Mark emails as important
router.put('/mark-important', async (req, res) => {
  try {
    const { emailIds } = req.body;

    if (!emailIds || !Array.isArray(emailIds)) {
      return res.status(400).json({ error: 'Invalid email IDs' });
    }

    await Email.update(
      { isImportant: true },
      { where: { id: { [Op.in]: emailIds } } }
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Mark as important error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Mark emails as starred
router.put('/mark-starred', async (req, res) => {
  try {
    const { emailIds } = req.body;

    if (!emailIds || !Array.isArray(emailIds)) {
      return res.status(400).json({ error: 'Invalid email IDs' });
    }

    await Email.update(
      { isStarred: true },
      { where: { id: { [Op.in]: emailIds } } }
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Mark as starred error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Move emails to folder
router.put('/move', async (req, res) => {
  try {
    const { emailIds, folderId } = req.body;

    if (!emailIds || !Array.isArray(emailIds) || !folderId) {
      return res.status(400).json({ error: 'Invalid parameters' });
    }

    const folder = await EmailFolder.findByPk(folderId);
    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    await Email.update(
      { folderId, folder: folder.type },
      { where: { id: { [Op.in]: emailIds } } }
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Move emails error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete emails
router.delete('/', async (req, res) => {
  try {
    const { emailIds } = req.body;

    if (!emailIds || !Array.isArray(emailIds)) {
      return res.status(400).json({ error: 'Invalid email IDs' });
    }

    // Soft delete - move to trash
    await Email.update(
      { folder: 'trash', status: 'deleted' },
      { where: { id: { [Op.in]: emailIds } } }
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Delete emails error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Permanently delete emails
router.delete('/permanent', async (req, res) => {
  try {
    const { emailIds } = req.body;

    if (!emailIds || !Array.isArray(emailIds)) {
      return res.status(400).json({ error: 'Invalid email IDs' });
    }

    await Email.destroy({
      where: { id: { [Op.in]: emailIds } }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Permanent delete emails error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get email statistics
router.get('/stats/overview', async (req, res) => {
  try {
    const stats = await Email.findAll({
      attributes: [
        [Email.sequelize.fn('COUNT', Email.sequelize.col('id')), 'total'],
        [Email.sequelize.fn('COUNT', Email.sequelize.literal('CASE WHEN "isRead" = false THEN 1 END')), 'unread'],
        [Email.sequelize.fn('COUNT', Email.sequelize.literal('CASE WHEN "isImportant" = true THEN 1 END')), 'important'],
        [Email.sequelize.fn('COUNT', Email.sequelize.literal('CASE WHEN "isStarred" = true THEN 1 END')), 'starred'],
        [Email.sequelize.fn('COUNT', Email.sequelize.literal('CASE WHEN "hasAttachments" = true THEN 1 END')), 'withAttachments'],
        [Email.sequelize.fn('COUNT', Email.sequelize.literal('CASE WHEN "isSent" = true THEN 1 END')), 'sent'],
        [Email.sequelize.fn('COUNT', Email.sequelize.literal('CASE WHEN "isDraft" = true THEN 1 END')), 'drafts']
      ],
      raw: true
    });

    res.json(stats[0]);
  } catch (error) {
    console.error('Get email stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get folder statistics
router.get('/stats/folders', async (req, res) => {
  try {
    const stats = await Email.findAll({
      attributes: [
        'folder',
        [Email.sequelize.fn('COUNT', Email.sequelize.col('id')), 'count'],
        [Email.sequelize.fn('COUNT', Email.sequelize.literal('CASE WHEN "isRead" = false THEN 1 END')), 'unread']
      ],
      group: ['folder'],
      raw: true
    });

    res.json(stats);
  } catch (error) {
    console.error('Get folder stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Sync emails from IMAP
router.post('/sync', async (req, res) => {
  try {
    const ImapService = require('../services/ImapService');
    const imapService = new ImapService();
    const { accountId, daysBack = 365 } = req.body;
    
    // Get IMAP accounts to sync
    let accounts;
    if (accountId) {
      const account = await EmailAccount.findByPk(accountId);
      if (!account) {
        return res.status(404).json({ error: 'Email account not found' });
      }
      accounts = [account];
    } else {
      accounts = await EmailAccount.findAll({
        where: { 
          type: { [Op.in]: ['imap', 'both'] },
          imapHost: { [Op.ne]: null },
          isActive: true
        }
      });
    }

    if (accounts.length === 0) {
      return res.status(400).json({ 
        error: 'No IMAP accounts configured',
        message: 'Please add an IMAP email account first'
      });
    }

    // Calculate date for historical sync
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - daysBack);

    console.log(`📧 Starting email sync for ${accounts.length} account(s), fetching ${daysBack} days back...`);

    let totalSynced = 0;
    const syncResults = [];

    // Sync each account
    for (const account of accounts) {
      try {
        console.log(`🔄 Syncing account: ${account.name} (${account.email})`);
        
        // Fetch historical emails
        const result = await imapService.fetchEmails(account, {
          maxMessages: 500, // Fetch up to 500 emails
          unseenOnly: false, // Fetch all emails, not just unread
          since: sinceDate
        });

        if (result.success && result.emails) {
          // Save emails to database with auto-created threads
          for (const emailData of result.emails) {
            try {
              // Check if email already exists (by messageId)
              const existingEmail = await Email.findOne({
                where: { 
                  messageId: emailData.messageId,
                  emailAccountId: account.id
                }
              });

              if (!existingEmail) {
                // Auto-create or find thread for this email
                const threadSubject = emailData.subject || 'no-subject';
                
                let thread = await EmailThread.findOne({
                  where: { 
                    emailAccountId: account.id,
                    subject: threadSubject
                  }
                });
                
                if (!thread) {
                  const { v4: uuidv4 } = require('uuid');
                  thread = await EmailThread.create({
                    id: uuidv4(),
                    subject: threadSubject,
                    participants: [emailData.from, emailData.to].filter(Boolean).join(', '),
                    emailAccountId: account.id,
                    lastMessageAt: emailData.date || new Date()
                  });
                  console.log(`📝 Created thread for: ${threadSubject}`);
                }
                
                // Create email with thread
                await Email.create({
                  ...emailData,
                  threadId: thread.id,
                  emailAccountId: account.id,
                  folder: 'inbox'
                });
                totalSynced++;
              }
            } catch (saveError) {
              console.error(`Error saving email: ${saveError.message}`);
            }
          }

          syncResults.push({
            accountId: account.id,
            accountName: account.name,
            accountEmail: account.email,
            emailsFound: result.emails.length,
            success: true
          });
          
          console.log(`✅ Synced ${result.emails.length} emails from ${account.name}`);
        } else {
          syncResults.push({
            accountId: account.id,
            accountName: account.name,
            accountEmail: account.email,
            emailsFound: 0,
            success: false,
            error: result.error || 'No emails found'
          });
        }
      } catch (accountError) {
        console.error(`Error syncing account ${account.name}:`, accountError.message);
        syncResults.push({
          accountId: account.id,
          accountName: account.name,
          accountEmail: account.email,
          success: false,
          error: accountError.message
        });
      }
    }

    console.log(`✅ Email sync completed. Total new emails: ${totalSynced}`);

    res.json({ 
      success: true,
      message: `Successfully synced ${totalSynced} new emails from ${accounts.length} account(s)`,
      totalSynced,
      accountsProcessed: accounts.length,
      daysBack,
      results: syncResults
    });
  } catch (error) {
    console.error('Sync emails error:', error);
    res.status(500).json({ error: 'Failed to trigger email sync', details: error.message });
  }
});

// Clear demo emails
router.post('/clear', async (req, res) => {
  try {
    const result = await Email.destroy({
      where: {
        isDraft: { [Op.or]: [true, null] }
      }
    });

    res.json({ 
      success: true,
      message: `Cleared ${result} demo/draft emails`,
      count: result
    });
  } catch (error) {
    console.error('Clear emails error:', error);
    res.status(500).json({ error: 'Failed to clear emails', details: error.message });
  }
});

module.exports = router;
