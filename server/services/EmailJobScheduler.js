const cron = require('node-cron');
const { FollowUpJob, Client, Conference, EmailTemplate, EmailAccount, Email } = require('../models');
const EmailService = require('./EmailService');
const TemplateEngine = require('./TemplateEngine');
const { Op } = require('sequelize');
const { prepareAttachmentsForSending } = require('../utils/attachmentUtils');
const { normalizeEmailList } = require('../utils/emailListUtils');
const { formatEmailHtml, logEmailHtmlPayload } = require('../utils/emailHtmlFormatter');
const stripHtml = (input = '') => input.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

const formatDateForQuote = (dateInput) => {
  const date = dateInput ? new Date(dateInput) : new Date();
  return date.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
};

const buildQuotedHtml = (email) => {
  if (!email) {
    return '';
  }

  const sentAt = formatDateForQuote(email.date || email.createdAt);
  const fromLine = email.from || 'our team';
  const previousHtml = email.bodyHtml || '';
  const previousText = email.bodyText ? `<p style="margin:0;">${email.bodyText}</p>` : '';

  return `
    <div style="margin-top: 16px; padding-left: 16px; border-left: 3px solid #d1d5db; color: #4b5563; font-size: 14px;">
      <p style="margin: 0 0 8px 0;">On ${sentAt}, ${fromLine} wrote:</p>
      <div>${previousHtml || previousText}</div>
    </div>
  `;
};

const buildQuotedText = (email) => {
  if (!email) {
    return '';
  }

  const sentAt = formatDateForQuote(email.date || email.createdAt);
  const fromLine = email.from || 'our team';
  const previousText = email.bodyText || stripHtml(email.bodyHtml || '');

  return `---- On ${sentAt}, ${fromLine} wrote ----\n${previousText}`;
};

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
      // CRITICAL: Reload job to get latest settings (threadRootMessageId from previous emails)
      // Reload with associations to preserve template, client, and conference
      // This ensures we have the most up-to-date threading information before processing
      await job.reload({
        include: [
          { model: Client, as: 'client' },
          { model: Conference, as: 'conference' },
          { model: EmailTemplate, as: 'template' }
        ]
      });
      
      // Ensure settings is an object (handle JSONB parsing)
      if (!job.settings || typeof job.settings !== 'object') {
        job.settings = job.settings ? (typeof job.settings === 'string' ? JSON.parse(job.settings) : {}) : {};
      }
      
      // Log current job settings for debugging
      console.log(`🔍 [Threading Debug] Job ${job.id} (attempt ${job.currentAttempt + 1}) settings:`, {
        threadRootMessageId: job.settings?.threadRootMessageId ? job.settings.threadRootMessageId.substring(0, 30) + '...' : 'null',
        currentAttempt: job.currentAttempt,
        stage: job.stage,
        settingsType: typeof job.settings,
        settingsKeys: Object.keys(job.settings || {})
      });
      
      // IMPORTANT: Reload client to get latest status (prevents race conditions with stale data)
      const freshClient = await Client.findByPk(job.clientId);
      if (!freshClient) {
        console.log(`⚠️  Client not found for job ${job.id}, skipping`);
        return;
      }
      
      // CRITICAL: After reload, associations might be lost - reload them if needed
      const { conference } = job;
      let activeTemplate = job.template || null;
      
      // If template is not loaded after reload, load it explicitly
      if (!activeTemplate && job.templateId) {
        console.log(`⚠️  [Template] Template not loaded after reload, loading explicitly: ${job.templateId}`);
        activeTemplate = await EmailTemplate.findByPk(job.templateId);
        if (!activeTemplate) {
          console.error(`❌ [Template] Template ${job.templateId} not found for job ${job.id}`);
          throw new Error(`Template ${job.templateId} not found for job ${job.id}`);
        }
        console.log(`✅ [Template] Successfully loaded template: ${activeTemplate.name} (ID: ${activeTemplate.id})`);
      }
      
      if (!activeTemplate) {
        console.error(`❌ [Template] No template found for job ${job.id} (templateId: ${job.templateId || 'null'})`);
        throw new Error(`No template found for job ${job.id} (templateId: ${job.templateId || 'null'})`);
      }
      
      console.log(`✅ [Template] Using template: ${activeTemplate.name} (ID: ${activeTemplate.id}) for job ${job.id}`);
      
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

      // Dynamic SMTP selection:
      // 1) Prefer conference-specific SMTP (settings.smtp_default_id)
      // 2) Fallback to global primary account (lowest sendPriority)
      // Threading is preserved via threadRootMessageId in job.settings
      const conferenceForSmtp = conferenceContext || conference;
      let smtpAccount = null;

      if (conferenceForSmtp?.settings && conferenceForSmtp.settings.smtp_default_id) {
        smtpAccount = await EmailAccount.findOne({
          where: {
            id: conferenceForSmtp.settings.smtp_default_id,
            isActive: true
          }
        });

        if (!smtpAccount) {
          console.warn(
            `⚠️  Conference "${conferenceForSmtp.name}" has smtp_default_id=${conferenceForSmtp.settings.smtp_default_id},` +
            ' but no active SMTP account was found. Falling back to primary SMTP account.'
          );
        }
      }

      // Fallback: use primary/global SMTP if conference-specific not configured or inactive
      if (!smtpAccount) {
        smtpAccount = await EmailAccount.findOne({
          where: {
            isActive: true
          },
          order: [
            ['sendPriority', 'ASC'],
            ['createdAt', 'ASC']
          ]
        });
      }

      if (!smtpAccount) {
        console.log('⚠️  No SMTP account found, skipping email');
        return;
      }

      // Diagnostic logging: Verify which SMTP account is being used
      console.log(`📧 [SMTP Selection] Using account: "${smtpAccount.name}" (${smtpAccount.email}) | Priority: ${smtpAccount.sendPriority} | Job ID: ${job.id}`);

      // Ensure we have a template - try multiple sources
      if (!activeTemplate && job.templateId) {
        console.log(`📋 [Template] Loading template ${job.templateId} for job ${job.id}`);
        activeTemplate = await EmailTemplate.findByPk(job.templateId);
        if (activeTemplate) {
          console.log(`✅ [Template] Loaded template: ${activeTemplate.name}`);
        }
      }

      const stageSequenceFromJob = Array.isArray(job.settings?.stageTemplateSequence)
        ? job.settings.stageTemplateSequence.map((id) => (typeof id === 'string' ? id.trim() : '')).filter(Boolean)
        : [];
      const stageSequence = stageSequenceFromJob.length
        ? stageSequenceFromJob
        : getConferenceStageSequence(conferenceContext || conference, job.stage);
      const desiredTemplateId = getTemplateIdForAttempt(stageSequence, attemptIndex, activeTemplate?.id);
      if (desiredTemplateId && (!activeTemplate || activeTemplate.id !== desiredTemplateId)) {
        console.log(`📋 [Template] Resolving template for attempt ${attemptIndex}: ${desiredTemplateId}`);
        const resolvedTemplate = await EmailTemplate.findByPk(desiredTemplateId);
        if (resolvedTemplate) {
          activeTemplate = resolvedTemplate;
          console.log(`✅ [Template] Resolved to template: ${resolvedTemplate.name}`);
        } else {
          console.warn(`⚠️  [Template] Template ${desiredTemplateId} not found`);
        }
      }

      if (!activeTemplate) {
        console.error(`❌ [Template] No template available for job ${job.id}. Job details:`, {
          jobId: job.id,
          templateId: job.templateId,
          stage: job.stage,
          hasJobTemplate: !!job.template,
          stageSequence: stageSequence,
          desiredTemplateId: desiredTemplateId
        });
        return;
      }

      // Render template
      const templateEngine = new TemplateEngine();
      const renderedTemplate = await templateEngine.renderTemplate(
        activeTemplate.id,
        freshClient.id,
        conferenceContext?.id || conference?.id
      );

      // Use the exact subject from the template - no modifications or prefixes
      let templateSubject = renderedTemplate.subject && renderedTemplate.subject.trim()
        ? renderedTemplate.subject.trim()
        : (activeTemplate.subject && activeTemplate.subject.trim() ? activeTemplate.subject.trim() : '');

      if (!templateSubject) {
        throw new Error(`Email subject cannot be empty for template ${activeTemplate.id}`);
      }

      // Get threading headers from previous emails
      // NOTE: Job was already reloaded at the start of this function (line 136) to get latest settings
      // Build proper threading chain: use most recent email's messageId as inReplyTo
      // and build References chain with all previous message IDs
      // Thread emails from the same job/stage together using threadRootMessageId
      const threadRootMessageId = job.settings?.threadRootMessageId; // May be set from initial email when client was added

      // USER REQUIREMENT: Each follow-up keeps the exact subject defined on its template
      // We'll quote the previous email content inside the body so recipients can see the history
      const finalSubject = templateSubject;
      console.log(`📧 [Threading] Follow-up email #${job.currentAttempt + 1} - Using template subject: "${finalSubject}"`);

      console.log(`📧 Sending follow-up with subject: "${finalSubject}" (Template: ${activeTemplate.name}, Stage: ${job.stage})`);

      // Send email using nodemailer directly
      const nodemailer = require('nodemailer');
      
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
      const threadingHeaders = {};
      
      // CRITICAL FIX: Build proper threading headers to ensure ALL follow-ups are in ONE thread
      // Strategy:
      // 1. If threadRootMessageId exists, find ALL emails in this thread from database
      // 2. Set In-Reply-To to the most recent email in the thread
      // 3. Set References to the full chain: root + all messageIds in chronological order
      // 4. This ensures Gmail threads all emails together even with different subjects
      
      if (threadRootMessageId) {
        // This is a subsequent email - find ALL emails in this thread from database
        // Query for emails that are part of this thread (by messageId, inReplyTo, or references)
        const allThreadEmails = await Email.findAll({
          where: {
            clientId: freshClient.id,
            isSent: true,
            status: 'sent',
            [Op.or]: [
              { messageId: threadRootMessageId },
              { inReplyTo: threadRootMessageId },
              { references: { [Op.like]: `%${threadRootMessageId}%` } }
            ]
          },
          order: [['createdAt', 'ASC']],
          attributes: ['messageId', 'inReplyTo', 'references', 'createdAt'],
          limit: 50
        });

        if (allThreadEmails.length > 0) {
          // Find the most recent email in the thread (last in chronological order)
          const mostRecentEmail = allThreadEmails[allThreadEmails.length - 1];
          threadingHeaders.inReplyTo = mostRecentEmail.messageId;

          // Build References chain: root + all messageIds in chronological order
          const referencesChain = [threadRootMessageId];
          allThreadEmails.forEach(email => {
            if (email.messageId && email.messageId !== threadRootMessageId && !referencesChain.includes(email.messageId)) {
              referencesChain.push(email.messageId);
            }
          });
          threadingHeaders.references = referencesChain.join(' ');

          console.log(`🔗 [Threading] Subsequent email - Root: ${threadRootMessageId.substring(0, 30)}... | InReplyTo: ${mostRecentEmail.messageId.substring(0, 30)}... | Chain: ${referencesChain.length} emails`);
        } else {
          // Thread root exists but no emails found yet - this shouldn't happen, but handle it
          // Reference the root email directly
          threadingHeaders.inReplyTo = threadRootMessageId;
          threadingHeaders.references = threadRootMessageId;
          console.log(`🔗 [Threading] Thread root exists but no emails found - using root as InReplyTo`);
        }
      } else {
        // This is the FIRST follow-up email - no threading headers needed
        // The threadRootMessageId will be set after this email is sent
        console.log(`🔗 [Threading] First follow-up email - no threading headers (will set thread root after send)`);
      }

      const formattedBodyHtml = formatEmailHtml(renderedTemplate.bodyHtml || '');
      logEmailHtmlPayload('follow-up', formattedBodyHtml);

      const previousEmailForQuote = await Email.findOne({
        where: {
          clientId: freshClient.id,
          isSent: true,
          status: 'sent'
        },
        order: [['createdAt', 'DESC']]
      });

      let finalBodyHtml = formattedBodyHtml;
      let finalBodyText = renderedTemplate.bodyText || stripHtml(renderedTemplate.bodyHtml || '');

      if (previousEmailForQuote) {
        const quotedHtml = buildQuotedHtml(previousEmailForQuote);
        const quotedText = buildQuotedText(previousEmailForQuote);
        if (quotedHtml) {
          finalBodyHtml = `${formattedBodyHtml}<div style="margin: 20px 0;"></div>${quotedHtml}`;
        }
        if (quotedText) {
          finalBodyText = `${finalBodyText}\n\n${quotedText}`;
        }
      }

      // Send the email with threading headers
      const mailOptions = {
        from: `${smtpAccount.name || 'Conference CRM'} <${smtpAccount.email}>`,
        to: freshClient.email,
        subject: finalSubject,
        text: finalBodyText,
        html: finalBodyHtml,
        ...threadingHeaders
      };
      
      // CRITICAL DEBUG: Log the final subject being sent and verify it's correct
      console.log(`📧 [Subject Debug] ==========================================`);
      console.log(`📧 [Subject Debug] Final subject being sent: "${finalSubject}"`);
      console.log(`📧 [Subject Debug] Template subject was: "${templateSubject}"`);
      console.log(`📧 [Subject Debug] Thread root exists: ${!!threadRootMessageId}`);
      console.log(`📧 [Subject Debug] ==========================================`);

      const conferenceFollowupCc = normalizeEmailList(conferenceContext?.settings?.followupCC);
      if (conferenceFollowupCc.length > 0) {
        mailOptions.cc = conferenceFollowupCc.join(', ');
        console.log(`📎 [Follow-up CC] Added ${conferenceFollowupCc.length} conference-level CC recipient(s) for job ${job.id}`);
      }

      const normalizedAttachments = prepareAttachmentsForSending(renderedTemplate.attachments);
      if (normalizedAttachments.length > 0) {
        mailOptions.attachments = normalizedAttachments;
      }

      // Log mail options (without sensitive data) for debugging
      console.log(`📤 [Email Send] Preparing to send email:`, {
        to: mailOptions.to,
        subject: mailOptions.subject,
        hasHtml: !!mailOptions.html,
        hasText: !!mailOptions.text,
        hasAttachments: normalizedAttachments.length > 0,
        hasInReplyTo: !!mailOptions.inReplyTo,
        hasReferences: !!mailOptions.references
      });

      let mailResult;
      try {
        mailResult = await transporter.sendMail(mailOptions);
        console.log(`✅ [Email Send] Nodemailer accepted email: ${mailResult.messageId}`);
      } catch (sendError) {
        console.error(`❌ [Email Send] Nodemailer error:`, sendError.message);
        console.error(`❌ [Email Send] Full error:`, sendError);
        throw sendError; // Re-throw to be caught by outer try-catch
      }

      // Create email record in database
      await Email.create({
        from: smtpAccount.email,
        to: freshClient.email,
        subject: finalSubject,
        bodyHtml: finalBodyHtml,
        bodyText: finalBodyText,
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

      // Persist thread metadata (root) if not already stored
      // Each follow-up email uses "Re: " + its own template subject, so we don't need to store threadSubject
      // Threading is maintained via In-Reply-To and References headers, not subject matching
      const updatedSettings = { ...(job.settings || {}) };
      let needsUpdate = false;

      // Store threadRootMessageId if this is the first follow-up email in the thread
      // This is used for In-Reply-To and References headers to maintain threading
      if (!updatedSettings.threadRootMessageId) {
        // First follow-up email - store its messageId as the thread root
        updatedSettings.threadRootMessageId = mailResult.messageId;
        updatedSettings.stage = job.stage; // Store stage for reference
        needsUpdate = true;
        console.log(`🔗 [Threading] Setting thread root for ${job.stage}: ${mailResult.messageId.substring(0, 30)}... | Subject: "${finalSubject}"`);
      }
      
      // Note: We don't store threadSubject anymore because each follow-up uses its own template subject with "Re:" prefix
      // Threading is maintained via In-Reply-To and References headers, not subject matching

      if (needsUpdate) {
        // Save settings to database - Sequelize handles JSONB automatically
        // Use explicit update to ensure JSONB is properly serialized
        await job.update({ 
          settings: updatedSettings 
        });
        // Update in-memory object immediately
        job.settings = updatedSettings;
        console.log(`💾 [Threading] Saved job settings. threadRootMessageId: ${updatedSettings.threadRootMessageId ? updatedSettings.threadRootMessageId.substring(0, 30) + '...' : 'null'}"`);
        
        // Verify the save by reloading (for debugging)
        await job.reload();
        // Ensure settings is parsed correctly after reload
        if (!job.settings || typeof job.settings !== 'object') {
          job.settings = job.settings ? (typeof job.settings === 'string' ? JSON.parse(job.settings) : {}) : {};
        }
        console.log(`✅ [Threading] Verified settings saved. After reload - threadRootMessageId: ${job.settings?.threadRootMessageId ? 'set' : 'null'}"`);
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
      console.error(`❌ Error details:`, {
        message: error.message,
        stack: error.stack,
        jobId: job.id,
        clientId: job.clientId,
        stage: job.stage,
        attempt: job.currentAttempt
      });
      
      // Re-throw the error so the caller knows the email failed
      throw error;
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
