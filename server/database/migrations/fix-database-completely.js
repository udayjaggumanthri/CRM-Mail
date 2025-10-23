const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('🚀 Starting comprehensive database fix...');
    
    try {
      // 1. Create organizations table first
      console.log('📋 Creating organizations table...');
      await queryInterface.createTable('organizations', {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        name: {
          type: DataTypes.STRING(255),
          allowNull: false,
        },
        domain: {
          type: DataTypes.STRING(255),
          allowNull: true,
        },
        description: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        settings: {
          type: DataTypes.JSON,
          allowNull: true,
        },
        billing: {
          type: DataTypes.JSON,
          allowNull: true,
        },
        status: {
          type: DataTypes.ENUM('active', 'inactive', 'suspended'),
          defaultValue: 'active',
        },
        ownerId: {
          type: DataTypes.UUID,
          allowNull: true,
        },
        subscriptionTier: {
          type: DataTypes.STRING(50),
          defaultValue: 'free',
        },
        limits: {
          type: DataTypes.JSON,
          allowNull: true,
        },
        usage: {
          type: DataTypes.JSON,
          allowNull: true,
        },
        isActive: {
          type: DataTypes.BOOLEAN,
          defaultValue: true,
        },
        trialEndsAt: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        createdAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
        updatedAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
        },
      });

      // 2. Create notifications table
      console.log('📋 Creating notifications table...');
      await queryInterface.createTable('notifications', {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        userId: {
          type: DataTypes.UUID,
          allowNull: false,
          references: {
            model: 'users',
            key: 'id',
          },
          onDelete: 'CASCADE',
        },
        type: {
          type: DataTypes.STRING(50),
          allowNull: false,
        },
        title: {
          type: DataTypes.STRING(255),
          allowNull: false,
        },
        message: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
        data: {
          type: DataTypes.JSON,
          allowNull: true,
        },
        isRead: {
          type: DataTypes.BOOLEAN,
          defaultValue: false,
        },
        priority: {
          type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
          defaultValue: 'medium',
        },
        sentAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
        createdAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
        updatedAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
        },
      });

      // 3. Create audit_logs table
      console.log('📋 Creating audit_logs table...');
      await queryInterface.createTable('audit_logs', {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        organizationId: {
          type: DataTypes.UUID,
          allowNull: true,
          references: {
            model: 'organizations',
            key: 'id',
          },
          onDelete: 'CASCADE',
        },
        userId: {
          type: DataTypes.UUID,
          allowNull: true,
          references: {
            model: 'users',
            key: 'id',
          },
          onDelete: 'SET NULL',
        },
        action: {
          type: DataTypes.STRING(100),
          allowNull: false,
        },
        entityType: {
          type: DataTypes.STRING(50),
          allowNull: false,
        },
        entityId: {
          type: DataTypes.UUID,
          allowNull: true,
        },
        details: {
          type: DataTypes.JSON,
          allowNull: true,
        },
        ipAddress: {
          type: DataTypes.STRING(45),
          allowNull: true,
        },
        userAgent: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        severity: {
          type: DataTypes.ENUM('low', 'medium', 'high', 'critical'),
          defaultValue: 'medium',
        },
        createdAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
      });

      // 4. Add missing columns to users table
      console.log('📋 Adding missing columns to users table...');
      const userColumns = [
        'organizationId', 'phone', 'department', 'jobTitle', 'isActive',
        'permissions', 'settings', 'isOwner', 'timezone', 'language',
        'emailVerified', 'emailVerificationToken', 'passwordResetToken',
        'passwordResetExpires', 'twoFactorEnabled', 'twoFactorSecret',
        'apiKey', 'apiKeyExpires'
      ];

      for (const column of userColumns) {
        const [results] = await queryInterface.sequelize.query(
          `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'users' AND COLUMN_NAME = '${column}'`
        );
        
        if (results.length === 0) {
          let columnDef;
          switch (column) {
            case 'organizationId':
              columnDef = {
                type: DataTypes.UUID,
                allowNull: true,
                references: {
                  model: 'organizations',
                  key: 'id',
                },
                onDelete: 'CASCADE',
              };
              break;
            case 'phone':
              columnDef = { type: DataTypes.STRING(20), allowNull: true };
              break;
            case 'department':
              columnDef = { type: DataTypes.STRING(100), allowNull: true };
              break;
            case 'jobTitle':
              columnDef = { type: DataTypes.STRING(100), allowNull: true };
              break;
            case 'isActive':
              columnDef = { type: DataTypes.BOOLEAN, defaultValue: true };
              break;
            case 'permissions':
            case 'settings':
              columnDef = { type: DataTypes.JSON, allowNull: true };
              break;
            case 'isOwner':
              columnDef = { type: DataTypes.BOOLEAN, defaultValue: false };
              break;
            case 'timezone':
              columnDef = { type: DataTypes.STRING(50), allowNull: true };
              break;
            case 'language':
              columnDef = { type: DataTypes.STRING(10), allowNull: true };
              break;
            case 'emailVerified':
              columnDef = { type: DataTypes.BOOLEAN, defaultValue: false };
              break;
            case 'emailVerificationToken':
            case 'passwordResetToken':
            case 'apiKey':
              columnDef = { type: DataTypes.STRING(255), allowNull: true };
              break;
            case 'passwordResetExpires':
            case 'apiKeyExpires':
              columnDef = { type: DataTypes.DATE, allowNull: true };
              break;
            case 'twoFactorEnabled':
              columnDef = { type: DataTypes.BOOLEAN, defaultValue: false };
              break;
            case 'twoFactorSecret':
              columnDef = { type: DataTypes.STRING(255), allowNull: true };
              break;
          }
          
          if (columnDef) {
            await queryInterface.addColumn('users', column, columnDef);
            console.log(`✅ Added ${column} to users table`);
          }
        } else {
          console.log(`⚠️ ${column} column already exists on users table`);
        }
      }

      // 5. Add missing columns to clients table
      console.log('📋 Adding missing columns to clients table...');
      const clientColumns = [
        'organizationId', 'title', 'middleName', 'dateOfBirth', 'gender',
        'alternateEmail', 'alternatePhone', 'department', 'jobTitle',
        'yearsOfExperience', 'expertise', 'abstractTitle', 'abstractContent',
        'abstractSubmittedAt', 'registrationDate', 'paymentStatus',
        'paymentAmount', 'paymentMethod', 'communicationPreferences',
        'currentStage', 'followUpCount', 'lastFollowUpDate', 'nextFollowUpDate',
        'followUpPaused', 'followUpPausedReason', 'engagement', 'tags',
        'priority', 'customFields', 'gdprConsent', 'gdprConsentDate',
        'unsubscribeDate', 'isUnsubscribed', 'socialMedia'
      ];

      for (const column of clientColumns) {
        const [results] = await queryInterface.sequelize.query(
          `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'clients' AND COLUMN_NAME = '${column}'`
        );
        
        if (results.length === 0) {
          let columnDef;
          switch (column) {
            case 'organizationId':
              columnDef = {
                type: DataTypes.UUID,
                allowNull: true,
                references: {
                  model: 'organizations',
                  key: 'id',
                },
                onDelete: 'CASCADE',
              };
              break;
            case 'title':
            case 'middleName':
            case 'gender':
            case 'alternateEmail':
            case 'alternatePhone':
            case 'department':
            case 'jobTitle':
            case 'expertise':
            case 'abstractTitle':
            case 'paymentStatus':
            case 'paymentMethod':
            case 'currentStage':
            case 'followUpPausedReason':
            case 'engagement':
            case 'priority':
              columnDef = { type: DataTypes.STRING(255), allowNull: true };
              break;
            case 'dateOfBirth':
            case 'abstractSubmittedAt':
            case 'registrationDate':
            case 'lastFollowUpDate':
            case 'nextFollowUpDate':
            case 'gdprConsentDate':
            case 'unsubscribeDate':
              columnDef = { type: DataTypes.DATE, allowNull: true };
              break;
            case 'yearsOfExperience':
            case 'followUpCount':
              columnDef = { type: DataTypes.INTEGER, allowNull: true };
              break;
            case 'paymentAmount':
              columnDef = { type: DataTypes.DECIMAL(10, 2), allowNull: true };
              break;
            case 'abstractContent':
            case 'communicationPreferences':
            case 'tags':
            case 'customFields':
            case 'socialMedia':
              columnDef = { type: DataTypes.TEXT, allowNull: true };
              break;
            case 'followUpPaused':
            case 'isUnsubscribed':
            case 'gdprConsent':
              columnDef = { type: DataTypes.BOOLEAN, defaultValue: false };
              break;
          }
          
          if (columnDef) {
            await queryInterface.addColumn('clients', column, columnDef);
            console.log(`✅ Added ${column} to clients table`);
          }
        } else {
          console.log(`⚠️ ${column} column already exists on clients table`);
        }
      }

      // 6. Add missing columns to conferences table
      console.log('📋 Adding missing columns to conferences table...');
      const conferenceColumns = [
        'organizationId', 'status', 'assignedTeamLeadId', 'assignedMemberIds',
        'metrics', 'revenue', 'conferenceSettings', 'location', 'contactInfo'
      ];

      for (const column of conferenceColumns) {
        const [results] = await queryInterface.sequelize.query(
          `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'conferences' AND COLUMN_NAME = '${column}'`
        );
        
        if (results.length === 0) {
          let columnDef;
          switch (column) {
            case 'organizationId':
              columnDef = {
                type: DataTypes.UUID,
                allowNull: true,
                references: {
                  model: 'organizations',
                  key: 'id',
                },
                onDelete: 'CASCADE',
              };
              break;
            case 'status':
              columnDef = { type: DataTypes.ENUM('active', 'inactive', 'completed', 'cancelled'), defaultValue: 'active' };
              break;
            case 'assignedTeamLeadId':
              columnDef = {
                type: DataTypes.UUID,
                allowNull: true,
                references: {
                  model: 'users',
                  key: 'id',
                },
                onDelete: 'SET NULL',
              };
              break;
            case 'assignedMemberIds':
            case 'metrics':
            case 'revenue':
            case 'conferenceSettings':
            case 'location':
            case 'contactInfo':
              columnDef = { type: DataTypes.JSON, allowNull: true };
              break;
          }
          
          if (columnDef) {
            await queryInterface.addColumn('conferences', column, columnDef);
            console.log(`✅ Added ${column} to conferences table`);
          }
        } else {
          console.log(`⚠️ ${column} column already exists on conferences table`);
        }
      }

      // 7. Add missing columns to email_templates table
      console.log('📋 Adding missing columns to email_templates table...');
      const [emailTemplateResults] = await queryInterface.sequelize.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'email_templates' AND COLUMN_NAME = 'organizationId'`
      );
      
      if (emailTemplateResults.length === 0) {
        await queryInterface.addColumn('email_templates', 'organizationId', {
          type: DataTypes.UUID,
          allowNull: true,
          references: {
            model: 'organizations',
            key: 'id',
          },
          onDelete: 'CASCADE',
        });
        console.log('✅ Added organizationId to email_templates table');
      } else {
        console.log('⚠️ organizationId column already exists on email_templates table');
      }

      // 8. Add missing columns to email_accounts table
      console.log('📋 Adding missing columns to email_accounts table...');
      const [emailAccountResults] = await queryInterface.sequelize.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'email_accounts' AND COLUMN_NAME = 'organizationId'`
      );
      
      if (emailAccountResults.length === 0) {
        await queryInterface.addColumn('email_accounts', 'organizationId', {
          type: DataTypes.UUID,
          allowNull: true,
          references: {
            model: 'organizations',
            key: 'id',
          },
          onDelete: 'CASCADE',
        });
        console.log('✅ Added organizationId to email_accounts table');
      } else {
        console.log('⚠️ organizationId column already exists on email_accounts table');
      }

      // 9. Create a default organization
      console.log('📋 Creating default organization...');
      const [orgResults] = await queryInterface.sequelize.query(
        `SELECT id FROM organizations WHERE name = 'Default Organization'`
      );
      
      if (orgResults.length === 0) {
        await queryInterface.bulkInsert('organizations', [{
          id: '00000000-0000-0000-0000-000000000001',
          name: 'Default Organization',
          domain: 'crm.local',
          description: 'Default organization for CRM system',
          status: 'active',
          isActive: true,
          subscriptionTier: 'free',
          createdAt: new Date(),
          updatedAt: new Date()
        }]);
        console.log('✅ Created default organization');
      } else {
        console.log('⚠️ Default organization already exists');
      }

      // 10. Update existing users to have organizationId
      console.log('📋 Updating existing users with organizationId...');
      await queryInterface.sequelize.query(
        `UPDATE users SET organizationId = '00000000-0000-0000-0000-000000000001' WHERE organizationId IS NULL`
      );
      console.log('✅ Updated existing users with organizationId');

      console.log('✅ Comprehensive database fix completed successfully');
      
    } catch (error) {
      console.error('❌ Database fix failed:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    console.log('🔄 Rolling back database changes...');
    
    try {
      // Drop tables in reverse order
      await queryInterface.dropTable('audit_logs');
      await queryInterface.dropTable('notifications');
      await queryInterface.dropTable('organizations');
      
      console.log('✅ Rollback completed');
    } catch (error) {
      console.error('❌ Rollback failed:', error);
      throw error;
    }
  }
};
