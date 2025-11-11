const cron = require('node-cron');
const { FollowUpJob, Client, Conference, EmailTemplate, EmailAccount } = require('../models');
const EmailService = require('./EmailService');
const TemplateEngine = require('./TemplateEngine');
const { Op } = require('sequelize');

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
      
      const { conference, template } = job;
      
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

      // Render template
      const templateEngine = new TemplateEngine();
      const renderedTemplate = await templateEngine.renderTemplate(
        template.id,
        freshClient.id,
        conference.id
      );

      // Validate subject line and fall back to template.subject if empty
      const emailSubject = renderedTemplate.subject && renderedTemplate.subject.trim() 
        ? renderedTemplate.subject 
        : template.subject;
      
      if (!emailSubject || !emailSubject.trim()) {
        throw new Error(`Email subject cannot be empty for template ${template.id}`);
      }

      console.log(`📧 Sending follow-up with subject: "${emailSubject}"`);

      // Send email using nodemailer directly
      const nodemailer = require('nodemailer');
      const { Email } = require('../models');
      
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

      // Get threading headers from previous emails
      const threadRootMessageId = job.settings?.threadRootMessageId;
      const threadingHeaders = {};
      
      if (threadRootMessageId) {
        // This is a follow-up email, add threading headers
        threadingHeaders.inReplyTo = threadRootMessageId;
        threadingHeaders.references = threadRootMessageId;
        console.log(`🔗 Threading follow-up email to: ${threadRootMessageId}`);
      }

      // Send the email with threading headers
      const mailResult = await transporter.sendMail({
        from: `${smtpAccount.name || 'Conference CRM'} <${smtpAccount.email}>`,
        to: freshClient.email,
        subject: emailSubject,
        text: renderedTemplate.bodyText,
        html: renderedTemplate.bodyHtml,
        ...threadingHeaders  // Add In-Reply-To and References headers for threading
      });

      // Create email record in database
      await Email.create({
        from: smtpAccount.email,
        to: freshClient.email,
        subject: emailSubject,
        bodyHtml: renderedTemplate.bodyHtml,
        bodyText: renderedTemplate.bodyText,
        date: new Date(),
        clientId: freshClient.id,
        conferenceId: conference.id,
        templateId: template.id,
        emailAccountId: smtpAccount.id,
        isSent: true,
        status: 'sent',
        messageId: mailResult.messageId,
        inReplyTo: threadRootMessageId || null,
        deliveredAt: new Date()
      });

      console.log(`✅ Follow-up email sent: ${mailResult.messageId}`);

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
          const conferenceSettings = conference.settings || {};
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
