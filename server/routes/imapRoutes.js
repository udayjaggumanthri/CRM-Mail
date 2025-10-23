const express = require('express');
const router = express.Router();
const { EmailAccount, Email, User } = require('../models');
const realTimeImapService = require('../services/RealTimeImapService');
const ImapService = require('../services/ImapService');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

const imapService = new ImapService();

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
};

router.use(authenticateToken);

router.get('/status', async (req, res) => {
  try {
    const accounts = await EmailAccount.findAll({
      where: { 
        imapHost: { [Op.ne]: null },
        isActive: true
      }
    });

    const totalConnections = realTimeImapService.connections?.size || 0;
    const isPolling = realTimeImapService.isRunning || false;
    
    const connections = Array.from(realTimeImapService.connections?.entries() || []).map(([accountId, client]) => ({
      accountId,
      connected: client?.connected || false
    }));

    res.json({
      isPolling,
      totalConnections,
      configuredAccounts: accounts.length,
      connections,
      lastSync: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get IMAP status error:', error);
    res.status(500).json({ error: 'Failed to get IMAP status', details: error.message });
  }
});

router.post('/polling', async (req, res) => {
  try {
    const { action } = req.body;

    if (action === 'start') {
      if (realTimeImapService.isRunning) {
        return res.json({ 
          success: true,
          message: 'IMAP polling is already running' 
        });
      }

      await realTimeImapService.startRealTimeSync();
      res.json({ 
        success: true,
        message: 'IMAP polling started successfully' 
      });
    } else if (action === 'stop') {
      if (!realTimeImapService.isRunning) {
        return res.json({ 
          success: true,
          message: 'IMAP polling is already stopped' 
        });
      }

      await realTimeImapService.stopRealTimeSync();
      res.json({ 
        success: true,
        message: 'IMAP polling stopped successfully' 
      });
    } else {
      res.status(400).json({ error: 'Invalid action. Use "start" or "stop"' });
    }
  } catch (error) {
    console.error('Control IMAP polling error:', error);
    res.status(500).json({ error: 'Failed to control IMAP polling', details: error.message });
  }
});

router.delete('/polling', async (req, res) => {
  try {
    await realTimeImapService.stopRealTimeSync();
    res.json({ 
      success: true,
      message: 'IMAP polling stopped successfully' 
    });
  } catch (error) {
    console.error('Stop IMAP polling error:', error);
    res.status(500).json({ error: 'Failed to stop IMAP polling', details: error.message });
  }
});

router.post('/test', async (req, res) => {
  try {
    const { accountId } = req.body;

    if (!accountId) {
      return res.status(400).json({ error: 'Account ID is required' });
    }

    const account = await EmailAccount.findByPk(accountId);
    if (!account) {
      return res.status(404).json({ error: 'Email account not found' });
    }

    if (!account.imapHost || !account.imapUsername || !account.imapPassword) {
      return res.status(400).json({ 
        error: 'IMAP configuration incomplete',
        suggestions: ['Ensure IMAP host, username, and password are configured']
      });
    }

    const testResult = await imapService.testConnection(account);
    
    if (testResult.success) {
      res.json({
        success: true,
        message: `Successfully connected to ${account.imapHost}`,
        details: testResult
      });
    } else {
      res.status(400).json({
        success: false,
        error: testResult.error,
        suggestions: testResult.suggestions || []
      });
    }
  } catch (error) {
    console.error('Test IMAP connection error:', error);
    res.status(500).json({ 
      error: 'Failed to test IMAP connection', 
      details: error.message,
      suggestions: ['Check your IMAP credentials and server settings']
    });
  }
});

router.post('/fetch', async (req, res) => {
  try {
    const { accountId, maxMessages = 10 } = req.body;

    if (!accountId) {
      return res.status(400).json({ error: 'Account ID is required' });
    }

    const account = await EmailAccount.findByPk(accountId);
    if (!account) {
      return res.status(404).json({ error: 'Email account not found' });
    }

    console.log(`📧 Fetching emails from ${account.name} (max: ${maxMessages})...`);
    const emails = await imapService.fetchEmails(account, maxMessages);

    res.json({
      success: true,
      message: `Fetched ${emails.length} emails`,
      emails: emails,
      count: emails.length
    });
  } catch (error) {
    console.error('Fetch emails error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch emails', 
      details: error.message 
    });
  }
});

module.exports = { router, realTimeImapService };
