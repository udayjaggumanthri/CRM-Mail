const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      console.log('🔄 Fixing complete database schema...');

      // Helper function to check if column exists
      const columnExists = async (tableName, columnName) => {
        try {
          const [results] = await queryInterface.sequelize.query(
            `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
             WHERE TABLE_NAME = '${tableName}' AND COLUMN_NAME = '${columnName}'`
          );
          return results.length > 0;
        } catch (error) {
          return false;
        }
      };

      // Helper function to check if table exists
      const tableExists = async (tableName) => {
        try {
          const [results] = await queryInterface.sequelize.query(
            `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
             WHERE TABLE_NAME = '${tableName}'`
          );
          return results.length > 0;
        } catch (error) {
          return false;
        }
      };

      // Create organizations table first (needed for foreign keys)
      if (!(await tableExists('organizations'))) {
        await queryInterface.createTable('organizations', {
          id: {
            type: DataTypes.STRING,
            primaryKey: true,
            allowNull: false
          },
          name: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
          },
          domain: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
          },
          description: {
            type: DataTypes.TEXT
          },
          settings: {
            type: DataTypes.JSON,
            defaultValue: () => ({
              branding: {
                logo: null,
                primaryColor: '#3B82F6',
                secondaryColor: '#1E40AF'
              },
              email: {
                fromName: 'Conference CRM',
                fromEmail: 'noreply@conference-crm.com'
              },
              features: {
                maxUsers: 10,
                maxConferences: 5,
                maxClients: 1000,
                maxEmailsPerDay: 1000
              }
            })
          },
          billing: {
            type: DataTypes.JSON,
            defaultValue: () => ({
              plan: 'starter',
              status: 'active',
              subscriptionId: null,
              currentPeriodStart: new Date(),
              currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              usage: {
                users: 0,
                conferences: 0,
                clients: 0,
                emailsSent: 0
              }
            })
          },
          status: {
            type: DataTypes.ENUM('active', 'trial', 'suspended', 'cancelled'),
            defaultValue: 'active'
          },
          ownerId: {
            type: DataTypes.STRING,
            allowNull: false
          },
          subscriptionTier: {
            type: DataTypes.ENUM('starter', 'pro', 'enterprise'),
            defaultValue: 'starter'
          },
          limits: {
            type: DataTypes.JSON,
            defaultValue: () => ({
              maxUsers: 10,
              maxConferences: 5,
              maxClients: 1000,
              maxEmailsPerDay: 1000,
              maxTemplates: 50,
              maxSmtpAccounts: 3
            })
          },
          usage: {
            type: DataTypes.JSON,
            defaultValue: () => ({
              users: 0,
              conferences: 0,
              clients: 0,
              emailsSent: 0,
              templates: 0,
              smtpAccounts: 0
            })
          },
          isActive: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
          },
          trialEndsAt: {
            type: DataTypes.DATE,
            allowNull: true
          },
          createdAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
          },
          updatedAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
          }
        });
        console.log('✅ Created organizations table');
      }

      // Add all missing columns to clients table
      const clientColumns = [
        { name: 'organizationId', type: DataTypes.STRING },
        { name: 'title', type: DataTypes.STRING },
        { name: 'middleName', type: DataTypes.STRING },
        { name: 'dateOfBirth', type: DataTypes.DATE },
        { name: 'gender', type: DataTypes.ENUM('Male', 'Female', 'Other', 'Prefer not to say') },
        { name: 'alternateEmail', type: DataTypes.STRING },
        { name: 'alternatePhone', type: DataTypes.STRING },
        { name: 'department', type: DataTypes.STRING },
        { name: 'jobTitle', type: DataTypes.STRING },
        { name: 'yearsOfExperience', type: DataTypes.INTEGER },
        { name: 'expertise', type: DataTypes.JSON },
        { name: 'abstractTitle', type: DataTypes.STRING },
        { name: 'abstractContent', type: DataTypes.TEXT },
        { name: 'abstractSubmittedAt', type: DataTypes.DATE },
        { name: 'registrationDate', type: DataTypes.DATE },
        { name: 'paymentStatus', type: DataTypes.ENUM('pending', 'paid', 'refunded', 'cancelled') },
        { name: 'paymentAmount', type: DataTypes.DECIMAL(10, 2) },
        { name: 'paymentMethod', type: DataTypes.STRING },
        { name: 'communicationPreferences', type: DataTypes.JSON },
        { name: 'currentStage', type: DataTypes.ENUM('initial', 'stage1', 'stage2', 'completed') },
        { name: 'followUpCount', type: DataTypes.INTEGER },
        { name: 'lastFollowUpDate', type: DataTypes.DATE },
        { name: 'nextFollowUpDate', type: DataTypes.DATE },
        { name: 'followUpPaused', type: DataTypes.BOOLEAN },
        { name: 'followUpPausedReason', type: DataTypes.STRING },
        { name: 'engagement', type: DataTypes.JSON },
        { name: 'tags', type: DataTypes.JSON },
        { name: 'priority', type: DataTypes.ENUM('low', 'medium', 'high', 'urgent') },
        { name: 'customFields', type: DataTypes.JSON },
        { name: 'gdprConsent', type: DataTypes.BOOLEAN },
        { name: 'gdprConsentDate', type: DataTypes.DATE },
        { name: 'unsubscribeDate', type: DataTypes.DATE },
        { name: 'isUnsubscribed', type: DataTypes.BOOLEAN },
        { name: 'socialMedia', type: DataTypes.JSON }
      ];

      for (const column of clientColumns) {
        if (!(await columnExists('clients', column.name))) {
          await queryInterface.addColumn('clients', column.name, {
            type: column.type,
            allowNull: true
          });
          console.log(`✅ Added ${column.name} to clients`);
        }
      }

      // Add missing columns to conferences table
      const conferenceColumns = [
        { name: 'organizationId', type: DataTypes.STRING },
        { name: 'status', type: DataTypes.ENUM('draft', 'active', 'paused', 'completed', 'cancelled') },
        { name: 'assignedTeamLeadId', type: DataTypes.STRING },
        { name: 'assignedMemberIds', type: DataTypes.JSON },
        { name: 'metrics', type: DataTypes.JSON },
        { name: 'revenue', type: DataTypes.JSON },
        { name: 'conferenceSettings', type: DataTypes.JSON },
        { name: 'location', type: DataTypes.JSON },
        { name: 'contactInfo', type: DataTypes.JSON }
      ];

      for (const column of conferenceColumns) {
        if (!(await columnExists('conferences', column.name))) {
          await queryInterface.addColumn('conferences', column.name, {
            type: column.type,
            allowNull: true
          });
          console.log(`✅ Added ${column.name} to conferences`);
        }
      }

      // Add organizationId to other tables
      const tablesToUpdate = ['email_templates', 'email_accounts', 'users'];
      for (const table of tablesToUpdate) {
        if (!(await columnExists(table, 'organizationId'))) {
          await queryInterface.addColumn(table, 'organizationId', {
            type: DataTypes.STRING,
            allowNull: true
          });
          console.log(`✅ Added organizationId to ${table}`);
        }
      }

      // Create notifications table if it doesn't exist
      if (!(await tableExists('notifications'))) {
        await queryInterface.createTable('notifications', {
          id: {
            type: DataTypes.STRING,
            primaryKey: true,
            allowNull: false
          },
          userId: {
            type: DataTypes.STRING,
            allowNull: false
          },
          type: {
            type: DataTypes.ENUM(
              'email_sent',
              'email_bounced',
              'client_added',
              'client_updated',
              'conference_created',
              'follow_up_completed',
              'system_alert',
              'user_activity'
            ),
            allowNull: false
          },
          title: {
            type: DataTypes.STRING,
            allowNull: false
          },
          message: {
            type: DataTypes.TEXT,
            allowNull: false
          },
          data: {
            type: DataTypes.JSON,
            defaultValue: () => ({})
          },
          priority: {
            type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
            defaultValue: 'medium'
          },
          isRead: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
          },
          readAt: {
            type: DataTypes.DATE,
            allowNull: true
          },
          sendEmail: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
          },
          emailSent: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
          },
          emailSentAt: {
            type: DataTypes.DATE,
            allowNull: true
          },
          isActive: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
          },
          createdAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
          },
          updatedAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
          }
        });
        console.log('✅ Created notifications table');
      }

      // Create audit_logs table if it doesn't exist
      if (!(await tableExists('audit_logs'))) {
        await queryInterface.createTable('audit_logs', {
          id: {
            type: DataTypes.STRING,
            primaryKey: true,
            allowNull: false
          },
          entityType: {
            type: DataTypes.ENUM(
              'user',
              'client',
              'conference',
              'email',
              'template',
              'organization',
              'system'
            ),
            allowNull: false
          },
          entityId: {
            type: DataTypes.STRING,
            allowNull: false
          },
          action: {
            type: DataTypes.STRING,
            allowNull: false
          },
          details: {
            type: DataTypes.JSON,
            defaultValue: () => ({})
          },
          userId: {
            type: DataTypes.STRING,
            allowNull: true
          },
          organizationId: {
            type: DataTypes.STRING,
            allowNull: true
          },
          ipAddress: {
            type: DataTypes.STRING,
            allowNull: true
          },
          userAgent: {
            type: DataTypes.STRING,
            allowNull: true
          },
          severity: {
            type: DataTypes.ENUM('low', 'medium', 'high', 'critical'),
            defaultValue: 'medium'
          },
          timestamp: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
          },
          isActive: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
          }
        });
        console.log('✅ Created audit_logs table');
      }

      console.log('✅ Schema fix completed successfully');
    } catch (error) {
      console.error('❌ Error fixing schema:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      console.log('🔄 Rolling back schema changes...');
      
      // Drop tables
      try {
        await queryInterface.dropTable('notifications');
        console.log('✅ Dropped notifications table');
      } catch (error) {
        console.log('⚠️ notifications table not found');
      }

      try {
        await queryInterface.dropTable('audit_logs');
        console.log('✅ Dropped audit_logs table');
      } catch (error) {
        console.log('⚠️ audit_logs table not found');
      }

      try {
        await queryInterface.dropTable('organizations');
        console.log('✅ Dropped organizations table');
      } catch (error) {
        console.log('⚠️ organizations table not found');
      }

      console.log('✅ Rollback completed');
    } catch (error) {
      console.error('❌ Error in rollback:', error);
      throw error;
    }
  }
};
