const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      console.log('🔄 Adding missing columns to database tables...');

      // Add missing columns to conferences table
      await queryInterface.addColumn('conferences', 'organizationId', {
        type: DataTypes.STRING,
        allowNull: true
      });

      await queryInterface.addColumn('conferences', 'status', {
        type: DataTypes.ENUM('draft', 'active', 'paused', 'completed', 'cancelled'),
        defaultValue: 'draft',
        allowNull: false
      });

      await queryInterface.addColumn('conferences', 'assignedTeamLeadId', {
        type: DataTypes.STRING,
        allowNull: true
      });

      await queryInterface.addColumn('conferences', 'assignedMemberIds', {
        type: DataTypes.JSON,
        defaultValue: () => ([]),
        allowNull: true
      });

      await queryInterface.addColumn('conferences', 'metrics', {
        type: DataTypes.JSON,
        defaultValue: () => ({
          totalClients: 0,
          abstractsSubmitted: 0,
          registrations: 0,
          emailsSent: 0,
          openRate: 0,
          clickRate: 0,
          conversionRate: 0
        }),
        allowNull: true
      });

      await queryInterface.addColumn('conferences', 'revenue', {
        type: DataTypes.JSON,
        defaultValue: () => ({
          target: 0,
          actual: 0,
          currency: 'USD',
          registrationFee: 0,
          sponsorshipRevenue: 0
        }),
        allowNull: true
      });

      await queryInterface.addColumn('conferences', 'conferenceSettings', {
        type: DataTypes.JSON,
        defaultValue: () => ({
          maxParticipants: 1000,
          registrationRequired: true,
          abstractRequired: true,
          paymentRequired: false,
          earlyBirdDiscount: 0,
          groupDiscount: 0,
          cancellationPolicy: '',
          refundPolicy: ''
        }),
        allowNull: true
      });

      await queryInterface.addColumn('conferences', 'location', {
        type: DataTypes.JSON,
        defaultValue: () => ({
          address: '',
          city: '',
          state: '',
          country: '',
          postalCode: '',
          coordinates: {
            latitude: null,
            longitude: null
          }
        }),
        allowNull: true
      });

      await queryInterface.addColumn('conferences', 'contactInfo', {
        type: DataTypes.JSON,
        defaultValue: () => ({
          phone: '',
          email: '',
          website: '',
          socialMedia: {
            twitter: '',
            linkedin: '',
            facebook: ''
          }
        }),
        allowNull: true
      });

      // Add missing columns to clients table
      await queryInterface.addColumn('clients', 'organizationId', {
        type: DataTypes.STRING,
        allowNull: true
      });

      await queryInterface.addColumn('clients', 'organizationName', {
        type: DataTypes.STRING,
        allowNull: true
      });

      // Add missing columns to email_templates table
      await queryInterface.addColumn('email_templates', 'organizationId', {
        type: DataTypes.STRING,
        allowNull: true
      });

      // Add missing columns to email_accounts table
      await queryInterface.addColumn('email_accounts', 'organizationId', {
        type: DataTypes.STRING,
        allowNull: true
      });

      // Create notifications table
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

      // Create audit_logs table
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

      // Add indexes for better performance
      await queryInterface.addIndex('conferences', ['status']);
      await queryInterface.addIndex('conferences', ['assignedTeamLeadId']);
      await queryInterface.addIndex('conferences', ['organizationId', 'status']);

      await queryInterface.addIndex('notifications', ['userId']);
      await queryInterface.addIndex('notifications', ['type']);
      await queryInterface.addIndex('notifications', ['priority']);
      await queryInterface.addIndex('notifications', ['isRead']);
      await queryInterface.addIndex('notifications', ['createdAt']);
      await queryInterface.addIndex('notifications', ['userId', 'isRead']);
      await queryInterface.addIndex('notifications', ['userId', 'type']);

      await queryInterface.addIndex('audit_logs', ['entityType']);
      await queryInterface.addIndex('audit_logs', ['entityId']);
      await queryInterface.addIndex('audit_logs', ['action']);
      await queryInterface.addIndex('audit_logs', ['userId']);
      await queryInterface.addIndex('audit_logs', ['organizationId']);
      await queryInterface.addIndex('audit_logs', ['severity']);
      await queryInterface.addIndex('audit_logs', ['timestamp']);
      await queryInterface.addIndex('audit_logs', ['entityType', 'entityId']);
      await queryInterface.addIndex('audit_logs', ['userId', 'timestamp']);
      await queryInterface.addIndex('audit_logs', ['organizationId', 'timestamp']);

      console.log('✅ Successfully added missing columns and created new tables');
    } catch (error) {
      console.error('❌ Error adding missing columns:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      console.log('🔄 Removing added columns and tables...');

      // Remove indexes first
      await queryInterface.removeIndex('conferences', ['status']);
      await queryInterface.removeIndex('conferences', ['assignedTeamLeadId']);
      await queryInterface.removeIndex('conferences', ['organizationId', 'status']);

      // Remove columns from conferences table
      await queryInterface.removeColumn('conferences', 'status');
      await queryInterface.removeColumn('conferences', 'assignedTeamLeadId');
      await queryInterface.removeColumn('conferences', 'assignedMemberIds');
      await queryInterface.removeColumn('conferences', 'metrics');
      await queryInterface.removeColumn('conferences', 'revenue');
      await queryInterface.removeColumn('conferences', 'conferenceSettings');
      await queryInterface.removeColumn('conferences', 'location');
      await queryInterface.removeColumn('conferences', 'contactInfo');

      // Remove columns from clients table
      await queryInterface.removeColumn('clients', 'organizationName');

      // Remove columns from email_templates table
      await queryInterface.removeColumn('email_templates', 'organizationId');

      // Remove columns from email_accounts table
      await queryInterface.removeColumn('email_accounts', 'organizationId');

      // Drop tables
      await queryInterface.dropTable('notifications');
      await queryInterface.dropTable('audit_logs');

      console.log('✅ Successfully removed added columns and tables');
    } catch (error) {
      console.error('❌ Error removing columns and tables:', error);
      throw error;
    }
  }
};
