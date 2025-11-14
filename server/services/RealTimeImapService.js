const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');
const { decryptEmailPassword } = require('../utils/passwordUtils');
// Import models dynamically to avoid circular dependencies
let Email, EmailAccount, EmailThread, EmailLog, Client;

class RealTimeImapService {
  constructor() {
    this.connections = new Map();
    this.idleConnections = new Map();
    this.isRunning = false;
    this.io = null; // WebSocket instance
    this.retryAttempts = new Map();
    this.maxRetries = 3;
    this.retryDelay = 5000;
  }

  /**
   * Initialize the real-time service with WebSocket
   */
  initialize(io) {
    this.io = io;
    console.log('🔄 Real-time IMAP service initialized');
  }

  /**
   * Initialize models (called after database is ready)
   */
  initializeModels(models) {
    Email = models.Email;
    EmailAccount = models.EmailAccount;
    EmailThread = models.EmailThread;
    EmailLog = models.EmailLog;
    Client = models.Client;
    console.log('📧 Real-time IMAP service models initialized');
  }

  /**
   * Start real-time IMAP monitoring for all accounts
   */
  async startRealTimeSync() {
    if (this.isRunning) {
      console.log('Real-time IMAP sync already running');
      return;
    }

    this.isRunning = true;
    console.log('🚀 Starting real-time IMAP sync...');

    try {
      // Get all IMAP-enabled accounts
      // Include accounts with IMAP configuration, regardless of type (some accounts might be 'smtp' but have IMAP config)
      const accounts = await EmailAccount.findAll({
        where: { 
          imapHost: { [Op.ne]: null },
          imapUsername: { [Op.ne]: null },
          isActive: true
        },
        order: [['createdAt', 'ASC']]
      });

      if (accounts.length === 0) {
        console.log('⚠️ No IMAP accounts configured for real-time sync');
        return;
      }

      console.log(`📧 Setting up real-time sync for ${accounts.length} account(s)`);

      // Start monitoring each account
      for (const account of accounts) {
        await this.startAccountMonitoring(account);
      }

      console.log('✅ Real-time IMAP sync started successfully');
    } catch (error) {
      console.error('❌ Failed to start real-time IMAP sync:', error.message);
      this.isRunning = false;
    }
  }

  /**
   * Start monitoring a specific account with IDLE support
   */
  async startAccountMonitoring(account) {
    try {
      // Determine account name for logging
      const accountName = account.name || account.email || account.imapHost || 'Unknown Account';
      console.log(`🔄 Setting up real-time monitoring for ${accountName}...`);

      // Create IMAP connection with IDLE support
      const client = new ImapFlow({
        host: account.imapHost,
        port: account.imapPort || 993,
        secure: account.imapSecure !== false,
        auth: {
          user: account.imapUsername,
          pass: decryptEmailPassword(account.imapPassword)
        },
        logger: false,
        idling: true // Enable IDLE support
      });

      await client.connect();
      console.log(`✅ Connected to ${accountName} (${account.imapHost})`);

      // Store connection
      this.connections.set(account.id, client);
      
      // Update database sync status
      try {
        await EmailAccount.update(
          { 
            syncStatus: 'active',
            lastSyncAt: new Date(),
            errorMessage: null
          },
          { where: { id: account.id } }
        );
      } catch (error) {
        console.error(`⚠️ Failed to update database status for ${accountName}:`, error.message);
      }

      // Start IDLE monitoring
      await this.startIdleMonitoring(account, client);

    } catch (error) {
      const accountName = account.name || account.email || account.imapHost || 'Unknown Account';
      console.error(`❌ Failed to setup monitoring for ${accountName}:`, error.message);
      await this.handleConnectionError(account, error);
    }
  }

  /**
   * Start IDLE monitoring for real-time email detection
   */
  async startIdleMonitoring(account, client) {
    try {
      // Determine account name for logging
      const accountName = account.name || account.email || account.imapHost || 'Unknown Account';
      
      // Open INBOX
      await client.mailboxOpen('INBOX');
      console.log(`📬 Monitoring INBOX for ${accountName}`);

      // Get initial message count safely
      let initialCount = 0;
      try {
        if (client.mailbox && client.mailbox.messages) {
          initialCount = client.mailbox.messages.total || 0;
        }
      } catch (error) {
        console.warn(`⚠️ Could not get initial message count for ${accountName}:`, error.message);
      }
      console.log(`📊 Initial message count for ${accountName}: ${initialCount}`);

      // Start IDLE monitoring
      let idlePromise;
      try {
        idlePromise = client.idle();
        console.log(`🔄 IDLE monitoring started for ${accountName}`);
      } catch (error) {
        console.warn(`⚠️ IDLE not supported for ${accountName}, falling back to polling:`, error.message);
        // Fallback to polling if IDLE is not supported
        this.startPollingFallback(account, client);
        return;
      }
      
      // Handle IDLE events
      client.on('mailboxUpdate', async (update) => {
        console.log(`📧 New email detected for ${accountName}:`, update);
        await this.handleNewEmails(account, client, update);
      });

      // Handle connection errors
      client.on('error', async (error) => {
        console.error(`❌ IMAP connection error for ${accountName}:`, error.message);
        await this.handleConnectionError(account, error);
      });

      // Keep IDLE alive
      setInterval(async () => {
        try {
          if (client.connected) {
            await client.noop(); // Keep connection alive
          }
        } catch (error) {
          console.error(`❌ Keep-alive failed for ${accountName}:`, error.message);
        }
      }, 30000); // Every 30 seconds

      console.log(`✅ IDLE monitoring started for ${accountName}`);

    } catch (error) {
      const accountName = account.name || account.email || account.imapHost || 'Unknown Account';
      console.error(`❌ Failed to start IDLE monitoring for ${accountName}:`, error.message);
      await this.handleConnectionError(account, error);
    }
  }

  /**
   * Fallback polling method when IDLE is not supported
   */
  startPollingFallback(account, client) {
    const accountName = account.name || account.email || account.imapHost || 'Unknown Account';
    console.log(`🔄 Starting polling fallback for ${accountName} (every 30 seconds)`);
    
    const pollInterval = setInterval(async () => {
      try {
        if (!client.connected) {
          console.log(`❌ Client disconnected for ${accountName}, stopping polling`);
          clearInterval(pollInterval);
          return;
        }
        
        // Check for new emails
        await this.checkForNewEmails(account, client);
      } catch (error) {
        console.error(`❌ Polling error for ${accountName}:`, error.message);
      }
    }, 30000); // Poll every 30 seconds
    
    // Store the interval for cleanup
    this.pollingIntervals = this.pollingIntervals || new Map();
    this.pollingIntervals.set(account.id, pollInterval);
  }

  /**
   * Check for new emails (polling method)
   */
  async checkForNewEmails(account, client) {
    try {
      // Get current message count
      const status = await client.status('INBOX', { messages: true });
      const currentCount = status.messages || 0;
      
      // Compare with stored count
      const lastCount = this.lastMessageCounts?.get(account.id) || 0;
      
      if (currentCount > lastCount) {
        console.log(`📧 New emails detected for ${account.name}: ${currentCount - lastCount} new`);
        
        // Fetch new emails
        const newEmails = await this.fetchNewEmails(account, client, lastCount + 1, currentCount);
        
        // Process new emails
        for (const email of newEmails) {
          await this.processNewEmail(account, email);
        }
        
        // Update stored count
        this.lastMessageCounts = this.lastMessageCounts || new Map();
        this.lastMessageCounts.set(account.id, currentCount);
        
        // Update database lastSyncAt when emails are fetched
        try {
          await EmailAccount.update(
            { 
              lastSyncAt: new Date(),
              syncStatus: 'active'
            },
            { where: { id: account.id } }
          );
        } catch (error) {
          console.error(`⚠️ Failed to update lastSyncAt for ${account.name}:`, error.message);
        }
      }
    } catch (error) {
      console.error(`❌ Error checking for new emails for ${account.name}:`, error.message);
    }
  }

  /**
   * Handle new emails detected via IDLE
   */
  async handleNewEmails(account, client, update) {
    try {
      console.log(`📬 Processing new emails for ${account.name}...`);

      // Get current message count
      const currentCount = client.mailbox.messages.total;
      console.log(`📊 Current message count: ${currentCount}`);

      // Fetch recent messages (last 10)
      const messages = await client.fetch({
        from: Math.max(1, currentCount - 9),
        to: currentCount
      }, { 
        envelope: true, 
        source: true, 
        internalDate: true,
        uid: true,
        flags: true
      });

      const newEmails = [];
      for await (const msg of messages) {
        try {
          const parsed = await simpleParser(msg.source);
          
          // Extract and normalize references field
          let references = parsed.headers.get('references');
          if (references && typeof references !== 'string') {
            references = Array.isArray(references) ? references.join(' ') : String(references);
          }
          
          const email = {
            id: uuidv4(),
            uid: msg.uid,
            from: parsed.from?.text || '',
            to: parsed.to?.text || '',
            cc: parsed.cc?.text || '',
            bcc: parsed.bcc?.text || '',
            subject: parsed.subject || '(no subject)',
            body: parsed.html || `<pre>${parsed.text || ''}</pre>`,
            bodyText: parsed.text || '',
            isRead: msg.flags?.has('\\Seen') || false,
            isImportant: msg.flags?.has('\\Flagged') || false,
            isDraft: msg.flags?.has('\\Draft') || false,
            isSent: false,
            isDeleted: false,
            folder: 'inbox',
            threadId: null,
            inReplyTo: parsed.headers.get('in-reply-to') || null,
            attachments: JSON.stringify((parsed.attachments || []).map(a => ({ 
              filename: a.filename, 
              size: a.size,
              contentType: a.contentType,
              contentId: a.contentId
            }))),
            sentAt: parsed.date ? new Date(parsed.date) : new Date(),
            receivedAt: msg.internalDate ? new Date(msg.internalDate) : new Date(),
            date: parsed.date ? new Date(parsed.date) : new Date(),
            clientId: null,
            userId: null,
            emailAccountId: account.id,
            flags: Array.from(msg.flags || []),
            messageId: parsed.messageId,
            references: references || null
          };

          // Process email (auto-creates thread and saves properly)
          await this.processNewEmail(account, email);
          newEmails.push(email);
        } catch (parseError) {
          console.error(`❌ Failed to parse email:`, parseError.message);
        }
      }

      // Update database lastSyncAt when emails are processed
      if (newEmails.length > 0) {
        try {
          await EmailAccount.update(
            { 
              lastSyncAt: new Date(),
              syncStatus: 'active'
            },
            { where: { id: account.id } }
          );
        } catch (error) {
          console.error(`⚠️ Failed to update lastSyncAt for ${account.name}:`, error.message);
        }
      }

      // Emit real-time update via WebSocket
      if (newEmails.length > 0 && this.io) {
        this.io.emit('newEmails', {
          accountId: account.id,
          accountName: account.name,
          emails: newEmails,
          count: newEmails.length
        });
        console.log(`📡 Real-time update sent: ${newEmails.length} new emails`);
      }

    } catch (error) {
      console.error(`❌ Error handling new emails for ${account.name}:`, error.message);
    }
  }

  /**
   * Handle connection errors with retry logic
   */
  async handleConnectionError(account, error) {
    const retryCount = this.retryAttempts.get(account.id) || 0;
    
    // Remove connection from map
    this.connections.delete(account.id);
    
    // Update database with error status
    try {
      await EmailAccount.update(
        { 
          syncStatus: retryCount < this.maxRetries ? 'error' : 'disconnected',
          errorMessage: error.message || 'Connection error'
        },
        { where: { id: account.id } }
      );
    } catch (dbError) {
      console.error(`⚠️ Failed to update database error status for ${account.name}:`, dbError.message);
    }
    
    if (retryCount < this.maxRetries) {
      console.log(`🔄 Retrying connection for ${account.name} (attempt ${retryCount + 1}/${this.maxRetries})`);
      
      this.retryAttempts.set(account.id, retryCount + 1);
      
      setTimeout(async () => {
        try {
          await this.startAccountMonitoring(account);
        } catch (retryError) {
          console.error(`❌ Retry failed for ${account.name}:`, retryError.message);
        }
      }, this.retryDelay);
    } else {
      console.error(`❌ Max retries exceeded for ${account.name}. Stopping monitoring.`);
      this.retryAttempts.delete(account.id);
      
      // Update database with final disconnected status
      try {
        await EmailAccount.update(
          { 
            syncStatus: 'disconnected',
            errorMessage: `Max retries reached: ${error.message || 'Connection failed'}`
          },
          { where: { id: account.id } }
        );
      } catch (dbError) {
        console.error(`⚠️ Failed to update database disconnected status for ${account.name}:`, dbError.message);
      }
    }
  }

  /**
   * Stop real-time monitoring
   */
  async stopRealTimeSync() {
    console.log('🛑 Stopping real-time IMAP sync...');
    
    this.isRunning = false;
    
    // Close all connections
    for (const [accountId, client] of this.connections) {
      try {
        if (client.connected) {
          await client.logout();
        }
      } catch (error) {
        console.error(`❌ Error closing connection for account ${accountId}:`, error.message);
      }
    }
    
    this.connections.clear();
    this.idleConnections.clear();
    this.retryAttempts.clear();
    
    console.log('✅ Real-time IMAP sync stopped');
  }

  /**
   * Get monitoring status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      activeConnections: this.connections.size,
      accounts: Array.from(this.connections.keys())
    };
  }

  /**
   * Fetch new emails from a range
   */
  async fetchNewEmails(account, client, startSeq, endSeq) {
    try {
      const emails = [];
      const messageSet = `${startSeq}:${endSeq}`;
      
      const messages = await client.fetch(messageSet, {
        envelope: true,
        source: true,
        internalDate: true,
        uid: true,
        flags: true
      });

      for await (const msg of messages) {
        try {
          const parsed = await simpleParser(msg.source);
          
          // Extract and normalize references field
          let references = parsed.headers.get('references');
          if (references && typeof references !== 'string') {
            references = Array.isArray(references) ? references.join(' ') : String(references);
          }
          
          const email = {
            id: uuidv4(),
            uid: msg.uid,
            from: parsed.from?.text || '',
            to: parsed.to?.text || '',
            cc: parsed.cc?.text || '',
            bcc: parsed.bcc?.text || '',
            subject: parsed.subject || '(no subject)',
            body: parsed.html || `<pre>${parsed.text || ''}</pre>`,
            bodyText: parsed.text || '',
            isRead: msg.flags?.has('\\Seen') || false,
            isImportant: msg.flags?.has('\\Flagged') || false,
            isDraft: msg.flags?.has('\\Draft') || false,
            isSent: false,
            isDeleted: false,
            threadId: null,
            inReplyTo: parsed.headers.get('in-reply-to') || null,
            attachments: JSON.stringify((parsed.attachments || []).map(a => ({
              filename: a.filename,
              size: a.size,
              contentType: a.contentType,
              contentId: a.contentId
            }))),
            sentAt: parsed.date ? new Date(parsed.date) : new Date(),
            receivedAt: msg.internalDate ? new Date(msg.internalDate) : new Date(),
            date: parsed.date ? new Date(parsed.date) : new Date(),
            clientId: null,
            userId: account.userId,
            flags: Array.from(msg.flags || []),
            messageId: parsed.messageId,
            references: references || null,
            emailAccountId: account.id,
            folder: 'inbox'
          };
          
          emails.push(email);
        } catch (parseError) {
          console.error(`❌ Failed to parse email:`, parseError.message);
        }
      }
      
      return emails;
    } catch (error) {
      console.error(`❌ Error fetching new emails:`, error.message);
      return [];
    }
  }

  /**
   * Process a single new email
   */
  async processNewEmail(account, email) {
    try {
      // Check if email already exists
      const existingEmail = await Email.findOne({
        where: { messageId: email.messageId }
      });

      if (!existingEmail) {
        // Auto-create or find thread for this email
        const threadIdentifier = email.inReplyTo || email.references || email.subject || 'no-subject';
        
        let thread = await EmailThread.findOne({
          where: { 
            emailAccountId: account.id,
            subject: email.subject || 'no-subject'
          }
        });

        if (!thread) {
          // Create new thread
          thread = await EmailThread.create({
            id: uuidv4(),
            subject: email.subject || 'no-subject',
            participants: JSON.stringify([email.from, email.to]),
            lastMessageId: email.messageId,
            lastMessageAt: email.date,
            messageCount: 1,
            isRead: email.isRead,
            isImportant: email.isImportant,
            emailAccountId: account.id,
            clientId: email.clientId,
            status: 'active'
          });
        } else {
          // Update existing thread
          await thread.update({
            lastMessageId: email.messageId,
            lastMessageAt: email.date,
            messageCount: thread.messageCount + 1,
            isRead: email.isRead
          });
        }

        // Set threadId for the email
        email.threadId = thread.id;

        // Ensure references is a string (not array/object)
        if (email.references && typeof email.references !== 'string') {
          email.references = Array.isArray(email.references) 
            ? email.references.join(' ') 
            : JSON.stringify(email.references);
        }

        // Store new email
        const savedEmail = await Email.create(email);
        
        // Create email log
        await EmailLog.create({
          id: uuidv4(),
          emailId: savedEmail.id,
          clientId: email.clientId,
          from: email.from,
          to: email.to,
          subject: email.subject,
          bodyPreview: (email.bodyText || '').substring(0, 100),
          status: 'received',
          smtpAccountId: account.id,
          messageId: email.messageId,
          in_reply_to: email.inReplyTo,
          thread_id: thread.id,
          receivedAt: email.receivedAt,
          attempts: 1,
          errorText: null,
          action: 'received'
        });
        
        console.log(`📧 New email processed: ${email.subject}`);
        
        // Emit real-time update
        if (this.io) {
          this.io.emit('newEmail', {
            accountId: account.id,
            email: savedEmail
          });
        }
      }
    } catch (error) {
      console.error(`Error saving email:`, error.message);
    }
  }
}

module.exports = new RealTimeImapService();
