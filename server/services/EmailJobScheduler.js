const cron = require('node-cron');
const { FollowUpJob, Client, Conference, EmailTemplate, EmailAccount } = require('../models');
const EmailService = require('./EmailService');
const TemplateEngine = require('./TemplateEngine');
const { Op } = require('sequelize');
const { prepareAttachmentsForSending } = require('../utils/attachmentUtils');
const { normalizeEmailList } = require('../utils/emailListUtils');

const getTemplateIdForAttempt = (sequence, attemptIndex, fallbackId) => {
  if (!Array.isArray(sequence) || sequence.length === 0) {
    return fallbackId || null;
  }
  if (attemptIndex <= 0) {
    return sequence[0];
  }
  if (attemptIndex >= sequence.length) {
    return sequence[sequence.length - 1];
  }
  return sequence[attemptIndex];
};

const getConferenceStageSequence = (conference, stage) => {
  if (!conference) {
    return [];
  }
  const settings = conference.settings || {};
  const rawSequence = stage === 'abstract_submission' || stage === 'stage1'
    ? settings.stage1Templates
    : settings.stage2Templates;
  const cleaned = Array.isArray(rawSequence)
    ? rawSequence.map((id) => (typeof id === 'string' ? id.trim() : '')).filter(Boolean)
    : [];
  if (cleaned.length === 0) {
    const fallback = (stage === 'abstract_submission' || stage === 'stage1')
      ? conference.stage1TemplateId
      : conference.stage2TemplateId;
    if (fallback) {
      cleaned.push(fallback);
    }
  }
  return cleaned;
};

const toNonNegativeInt = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) {
    return 0;
  }
  return Math.floor(num);
};

class EmailJobScheduler {
  constructor() {
    this.isRunning = false;
    this.cronJob = null;
  }

  start() {
    if (this.isRunning) {
      console.log('⚠️  Email job scheduler is already running');
      return;
    }

    console.log('🚀 Starting Email Job Scheduler...');
    
    // Run every minute to check for pending emails
    this.cronJob = cron.schedule('* * * * *', async () => {
      await this.processScheduledEmails();
    });

    this.isRunning = true;
    console.log('✅ Email Job Scheduler started (runs every minute)');
  }

  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.isRunning = false;
      console.log('🛑 Email Job Scheduler stopped');
    }
  }

  async processScheduledEmails() {
    try {
      const now = new Date();
      
      // Find all active follow-up jobs that are due
      const dueJobs = await FollowUpJob.findAll({
        where: {
          status: 'active',
          paused: false,
          scheduledDate: {
            [Op.lte]: now
          },
          currentAttempt: {
            [Op.lt]: require('sequelize').col('maxAttempts')
          }
        },
        include: [
          {
            model: Client,
            as: 'client',
            where: { isActive: true }
          },
          {
            model: Conference,
            as: 'conference',
            where: { isActive: true }
          },
          {
            model: EmailTemplate,
            as: 'template',
            where: { isActive: true }
          }
        ]
      });

      if (dueJobs.length > 0) {
        console.log(`📧 Found ${dueJobs.length} email(s) to send`);
      }

      for (const job of dueJobs) {
        await this.sendFollowUpEmail(job);
      }
    } catch (error) {
      console.error('❌ Error processing scheduled emails:', error);
    }
  }

  async sendFollowUpEmail(job) {
    try {
      // IMPORTANT: Reload client to get latest status (prevents race conditions with stale data)
      const freshClient = await Client.findByPk(job.clientId);
      if (!freshClient) {
        console.log(`⚠️  Client not found for job ${job.id}, skipping`);
        return;
      }
      
      const { conference } = job;
      let activeTemplate = job.template || null;
      const attemptIndex = job.currentAttempt || 0;

      let conferenceContext = conference || null;
      const conferenceId = job.conferenceId || conference?.id;
      if (conferenceId) {
        try {
          conferenceContext = await Conference.findByPk(conferenceId);
        } catch (confErr) {
          console.warn(`⚠️  Unable to load latest conference data for ID ${conferenceId}:`, confErr.message);
        }
      }
      
      const intervalSummary = job.settings?.intervalConfig
        ? `${job.settings.intervalConfig.value} ${job.settings.intervalConfig.unit}`
        : job.customInterval
          ? `${job.customInterval} day(s) [legacy]`
          : 'default';
      console.log(
        `📤 Sending follow-up email to ${freshClient.email} ` +
        `(Stage: ${job.stage}, Attempt: ${job.currentAttempt + 1}/${job.maxAttempts}, Interval: ${intervalSummary})`
      );

      // RUNTIME SAFETY CHECKS: Prevent sending wrong-stage emails (handles race conditions)
      
      // Stage 1 emails should ONLY send to clients with status "Lead"
      if (job.stage === 'abstract_submission' && freshClient.status !== 'Lead') {
        console.log(`⚠️  Client ${freshClient.email} is no longer "Lead" (current: ${freshClient.status}) - stopping Stage 1 job`);
        await job.update({
          status: 'stopped',
          completedAt: new Date()
        });
        return; // Skip sending this email
      }

      // Stage 2 emails should NOT send to Registered clients
      if (job.stage === 'registration' && freshClient.status === 'Registered') {
        console.log(`✅ Client ${freshClient.email} already registered - stopping Stage 2 job`);
        await job.update({
          status: 'stopped',
          completedAt: new Date()
        });
        return; // Skip sending this email
      }

      // Any email should stop if client is Registered
      if (freshClient.status === 'Registered') {
        console.log(`✅ Client ${freshClient.email} already registered - stopping all follow-up jobs`);
        await job.update({
          status: 'stopped',
          completedAt: new Date()
        });
        return; // Skip sending this email
      }

      // Dynamic SMTP selection: Always uses account with lowest sendPriority (primary)
      // This allows admin to change primary SMTP mid-follow-up without breaking sequences
      // Threading is preserved via threadRootMessageId in job.settings
      // Get SMTP account
      const smtpAccount = await EmailAccount.findOne({
        where: {
          isActive: true
        },
        order: [
          ['sendPriority', 'ASC'],
          ['createdAt', 'ASC']
        ]
      });

      if (!smtpAccount) {
        console.log('⚠️  No SMTP account found, skipping email');
        return;
      }

      // Diagnostic logging: Verify which SMTP account is being used
      console.log(`📧 [SMTP Selection] Using account: "${smtpAccount.name}" (${smtpAccount.email}) | Priority: ${smtpAccount.sendPriority} | Job ID: ${job.id}`);

      const stageSequenceFromJob = Array.isArray(job.settings?.stageTemplateSequence)
        ? job.settings.stageTemplateSequence.map((id) => (typeof id === 'string' ? id.trim() : '')).filter(Boolean)
        : [];
      const stageSequence = stageSequenceFromJob.length
        ? stageSequenceFromJob
        : getConferenceStageSequence(conferenceContext || conference, job.stage);
      const desiredTemplateId = getTemplateIdForAttempt(stageSequence, attemptIndex, activeTemplate?.id);
      if (desiredTemplateId && (!activeTemplate || activeTemplate.id !== desiredTemplateId)) {
        const resolvedTemplate = await EmailTemplate.findByPk(desiredTemplateId);
        if (resolvedTemplate) {
          activeTemplate = resolvedTemplate;
        }
      }

      if (!activeTemplate) {
        console.warn(`⚠️  No template available for job ${job.id}. Skipping send.`);
        return;
      }

      // Render template
      const templateEngine = new TemplateEngine();
      const renderedTemplate = await templateEngine.renderTemplate(
        activeTemplate.id,
        freshClient.id,
        conferenceContext?.id || conference?.id
      );

      const renderedSubject = renderedTemplate.subject && renderedTemplate.subject.trim()
        ? renderedTemplate.subject
        : activeTemplate.subject;

      let finalSubject = renderedSubject;
      const storedThreadSubject = job.settings?.threadSubject;
      if (storedThreadSubject && storedThreadSubject.trim()) {
        finalSubject = storedThreadSubject.trim();
      }

      if (!finalSubject || !finalSubject.trim()) {
        throw new Error(`Email subject cannot be empty for template ${activeTemplate.id}`);
      }

      console.log(`📧 Sending follow-up with subject: "${finalSubject}"`);

      // Send email using nodemailer directly
      const nodemailer = require('nodemailer');
      const { Email } = require('../models');
      
      // Create transporter for this SMTP account
      const { decryptEmailPassword } = require('../utils/passwordUtils');
      const transporter = nodemailer.createTransport({
        host: smtpAccount.smtpHost,
        port: smtpAccount.smtpPort,
        secure: smtpAccount.smtpPort === 465,
        auth: {
          user: smtpAccount.smtpUsername,
          pass: decryptEmailPassword(smtpAccount.smtpPassword)
        }
      });

      // Get threading headers from previous emails
      // Build proper threading chain: use most recent email's messageId as inReplyTo
      // and build References chain with all previous message IDs
      const threadRootMessageId = job.settings?.threadRootMessageId;
      const threadingHeaders = {};
      
      if (threadRootMessageId) {
        // Find the most recent email sent to this client (for inReplyTo)
        // and build References chain with all emails in the thread
        const previousEmails = await Email.findAll({
          where: {
            clientId: freshClient.id,
            isSent: true,
            status: 'sent'
          },
          order: [['createdAt', 'ASC']],
          attributes: ['messageId', 'inReplyTo', 'references'],
          limit: 50 // Reasonable limit for thread chain
        });

        if (previousEmails.length > 0) {
          // Use the most recent email's messageId as inReplyTo
          const mostRecentEmail = previousEmails[previousEmails.length - 1];
          threadingHeaders.inReplyTo = mostRecentEmail.messageId;

          // Build References chain: start with root, then add all previous messageIds
          const referencesChain = [threadRootMessageId];
          previousEmails.forEach(email => {
            if (email.messageId && !referencesChain.includes(email.messageId)) {
              referencesChain.push(email.messageId);
            }
          });
          threadingHeaders.references = referencesChain.join(' ');

          console.log(`🔗 [Threading] Preserving thread - Root: ${threadRootMessageId.substring(0, 30)}... | InReplyTo: ${mostRecentEmail.messageId.substring(0, 30)}... | Chain length: ${referencesChain.length}`);
        } else {
          // Fallback: use root messageId if no previous emails found
          threadingHeaders.inReplyTo = threadRootMessageId;
          threadingHeaders.references = threadRootMessageId;
          console.log(`🔗 [Threading] Using root messageId (no previous emails found): ${threadRootMessageId.substring(0, 50)}...`);
        }
      } else {
        console.log(`⚠️  [Threading] No threadRootMessageId found in job settings - this is the first email in thread`);
      }

      // Send the email with threading headers
      const mailOptions = {
        from: `${smtpAccount.name || 'Conference CRM'} <${smtpAccount.email}>`,
        to: freshClient.email,
        subject: finalSubject,
        text: renderedTemplate.bodyText,
        html: renderedTemplate.bodyHtml,
        ...threadingHeaders
      };

      const conferenceFollowupCc = normalizeEmailList(conferenceContext?.settings?.followupCC);
      if (conferenceFollowupCc.length > 0) {
        mailOptions.cc = conferenceFollowupCc.join(', ');
        console.log(`📎 [Follow-up CC] Added ${conferenceFollowupCc.length} conference-level CC recipient(s) for job ${job.id}`);
      }

      const normalizedAttachments = prepareAttachmentsForSending(renderedTemplate.attachments);
      if (normalizedAttachments.length > 0) {
        mailOptions.attachments = normalizedAttachments;
      }

      const mailResult = await transporter.sendMail(mailOptions);

      // Create email record in database
      await Email.create({
        from: smtpAccount.email,
        to: freshClient.email,
        subject: finalSubject,
        bodyHtml: renderedTemplate.bodyHtml,
        bodyText: renderedTemplate.bodyText,
        date: new Date(),
        clientId: freshClient.id,
        conferenceId: conferenceContext?.id || conference?.id,
        templateId: activeTemplate.id,
        emailAccountId: smtpAccount.id,
        isSent: true,
        status: 'sent',
        messageId: mailResult.messageId,
        inReplyTo: threadingHeaders.inReplyTo || threadRootMessageId || null,
        references: threadingHeaders.references || threadRootMessageId || null,
        deliveredAt: new Date()
      });

      console.log(`✅ Follow-up email sent: ${mailResult.messageId}`);

      // Persist thread metadata (root + subject) if not already stored
      if (!job.settings?.threadRootMessageId || !job.settings?.threadSubject) {
        const updatedSettings = { ...(job.settings || {}) };
        if (!updatedSettings.threadRootMessageId) {
          updatedSettings.threadRootMessageId = mailResult.messageId;
        }
        if (!updatedSettings.threadSubject && finalSubject) {
          updatedSettings.threadSubject = finalSubject;
        }
        await job.update({ settings: updatedSettings });
        job.settings = updatedSettings;
      }

      // Update client engagement and manual-follow-up counters
      const currentEngagement = freshClient.engagement || {};
      const manualUpdates = {};

      if (job.stage === 'abstract_submission') {
        const stage1Baseline =
          freshClient.manualStage1Count !== undefined && freshClient.manualStage1Count !== null
            ? toNonNegativeInt(freshClient.manualStage1Count)
            : toNonNegativeInt(freshClient.manualEmailsCount);
        const legacyBaseline = toNonNegativeInt(freshClient.manualEmailsCount);
        manualUpdates.manualStage1Count = stage1Baseline + 1;
        manualUpdates.manualEmailsCount = legacyBaseline + 1;
      } else if (job.stage === 'registration') {
        manualUpdates.manualStage2Count = toNonNegativeInt(freshClient.manualStage2Count) + 1;
      }

      await freshClient.update({
        engagement: {
          ...currentEngagement,
          emailsSent: (currentEngagement.emailsSent || 0) + 1,
          lastEmailSent: new Date()
        },
        lastFollowUpDate: new Date(),
        ...manualUpdates
      });

      // Update follow-up job
      const nextAttempt = job.currentAttempt + 1;
      
      if (nextAttempt >= job.maxAttempts) {
        // Max attempts reached, mark as stopped
        await job.update({
          status: 'stopped',
          currentAttempt: nextAttempt,
          completedAt: new Date()
        });
        console.log(`✅ Follow-up sequence stopped for ${freshClient.email} (Stage: ${job.stage}) - max attempts reached`);
        
        // Automatic Unresponsive Marking
        if (job.stage === 'abstract_submission' && freshClient.status === 'Lead') {
          // Stage 1 max reached and still a Lead - mark as Unresponsive
          await freshClient.update({ 
            status: 'Unresponsive',
            currentStage: 'stage1'
          });
          console.log(`⚠️  Client ${freshClient.email} marked as "Unresponsive" - Stage 1 max reached with no progress`);
        } else if (job.stage === 'registration' && freshClient.status === 'Abstract Submitted') {
          // Stage 2 max reached and still Abstract Submitted - mark as Registration Unresponsive
          await freshClient.update({ 
            status: 'Registration Unresponsive',
            currentStage: 'stage2'
          });
          console.log(`⚠️  Client ${freshClient.email} marked as "Registration Unresponsive" - Stage 2 max reached with no progress`);
        }
      } else {
        // Schedule next follow-up using conference-specific interval
        let intervalConfig;
        
        // Check if job has stored interval config
        if (job.settings && job.settings.intervalConfig) {
          intervalConfig = job.settings.intervalConfig;
        } else if (job.customInterval) {
          // Backwards compatibility: customInterval is in days
          intervalConfig = { value: job.customInterval, unit: 'days' };
        } else {
          // Get from conference settings
          const conferenceSettings = conferenceContext?.settings || conference?.settings || {};
          const followupIntervals = conferenceSettings.followup_intervals || { 
            "Stage1": { value: 7, unit: "days" }, 
            "Stage2": { value: 3, unit: "days" } 
          };
          
          if (job.stage === 'abstract_submission') {
            intervalConfig = followupIntervals.Stage1 || { value: 7, unit: "days" };
          } else if (job.stage === 'registration') {
            intervalConfig = followupIntervals.Stage2 || { value: 3, unit: "days" };
          } else {
            intervalConfig = { value: 7, unit: "days" }; // fallback
          }
        }
        
        const nextDate = this.calculateNextSendDate(intervalConfig, job.skipWeekends);
        
        await job.update({
          currentAttempt: nextAttempt,
          scheduledDate: nextDate,
          lastSentAt: new Date()
        });
        
        const intervalStr = typeof intervalConfig === 'object' 
          ? `${intervalConfig.value} ${intervalConfig.unit}` 
          : `${intervalConfig} days`;
        console.log(`✅ Email sent to ${freshClient.email}. Next follow-up: ${nextDate.toISOString()} (${intervalStr})`);
      }
    } catch (error) {
      console.error(`❌ Error sending follow-up email for job ${job.id}:`, error);
      
      // Don't update status to 'failed' since it's not in the enum
      // Job will stay active and retry on next cron run
    }
  }

  intervalToMilliseconds(interval) {
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

  calculateNextSendDate(interval, skipWeekends = true) {
    const now = new Date();
    const milliseconds = this.intervalToMilliseconds(interval);
    let nextDate = new Date(now.getTime() + milliseconds);
    
    // Skip weekends if enabled (only for intervals >= 1 day)
    if (skipWeekends && milliseconds >= 24 * 60 * 60 * 1000) {
      while (nextDate.getDay() === 0 || nextDate.getDay() === 6) {
        nextDate.setDate(nextDate.getDate() + 1);
      }
    }
    
    return nextDate;
  }
}

module.exports = EmailJobScheduler;
