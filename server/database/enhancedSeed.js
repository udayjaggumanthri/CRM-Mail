const { sequelize, User, Role, Conference, Client, Email, EmailTemplate, FollowUpJob, EmailLog, EmailAccount, EmailFolder, EmailThread, Campaign } = require('../models');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const seedEnhancedData = async () => {
  try {
    console.log('🌱 Starting enhanced data seeding...');

    // 1. Create Roles
    const ceoRole = await Role.findOrCreate({
      where: { name: 'CEO' },
      defaults: {
        id: uuidv4(),
        name: 'CEO',
        displayName: 'Chief Executive Officer',
        description: 'Full system access and management',
        permissions: {
          users: ['create', 'read', 'update', 'delete'],
          conferences: ['create', 'read', 'update', 'delete'],
          clients: ['create', 'read', 'update', 'delete'],
          campaigns: ['create', 'read', 'update', 'delete'],
          templates: ['create', 'read', 'update', 'delete'],
          smtp: ['create', 'read', 'update', 'delete'],
          reports: ['read']
        },
        level: 1,
        isActive: true
      }
    });

    const teamLeadRole = await Role.findOrCreate({
      where: { name: 'TeamLead' },
      defaults: {
        id: uuidv4(),
        name: 'TeamLead',
        displayName: 'Team Lead',
        description: 'Manage team members and assigned clients',
        permissions: {
          users: ['read'],
          conferences: ['read'],
          clients: ['create', 'read', 'update'],
          campaigns: ['create', 'read', 'update'],
          templates: ['create', 'read', 'update'],
          smtp: ['read'],
          reports: ['read']
        },
        level: 2,
        isActive: true
      }
    });

    const memberRole = await Role.findOrCreate({
      where: { name: 'Member' },
      defaults: {
        id: uuidv4(),
        name: 'Member',
        displayName: 'Team Member',
        description: 'Manage assigned clients only',
        permissions: {
          users: [],
          conferences: ['read'],
          clients: ['read', 'update'],
          campaigns: ['read'],
          templates: ['read'],
          smtp: [],
          reports: ['read']
        },
        level: 3,
        isActive: true
      }
    });

    console.log('✅ Roles created');

    // 2. Create Users with hierarchy
    const ceoUser = await User.findOrCreate({
      where: { email: 'admin@crm.com' },
      defaults: {
        id: uuidv4(),
        email: 'admin@crm.com',
        password: bcrypt.hashSync('admin123', 10),
        name: 'Admin User',
        role: 'CEO',
        roleId: ceoRole[0].id,
        hierarchyLevel: 1,
        isActive: true
      }
    });

    const teamLeadUser = await User.findOrCreate({
      where: { email: 'teamlead@crm.com' },
      defaults: {
        id: uuidv4(),
        email: 'teamlead@crm.com',
        password: bcrypt.hashSync('teamlead123', 10),
        name: 'Team Lead User',
        role: 'TeamLead',
        roleId: teamLeadRole[0].id,
        hierarchyLevel: 2,
        managerId: ceoUser[0].id,
        isActive: true
      }
    });

    const memberUser = await User.findOrCreate({
      where: { email: 'member@crm.com' },
      defaults: {
        id: uuidv4(),
        email: 'member@crm.com',
        password: bcrypt.hashSync('member123', 10),
        name: 'Member User',
        role: 'Member',
        roleId: memberRole[0].id,
        hierarchyLevel: 3,
        managerId: teamLeadUser[0].id,
        isActive: true
      }
    });

    console.log('✅ Users created with hierarchy');

    // 3. Create Conferences with settings
    const conference1 = await Conference.findOrCreate({
      where: { id: 'conf-1' },
      defaults: {
        id: 'conf-1',
        name: 'Tech Conference 2024',
        venue: 'Convention Center, San Francisco',
        startDate: new Date('2024-06-15'),
        endDate: new Date('2024-06-17'),
        primaryContactUserId: ceoUser[0].id,
        currency: 'USD',
        abstractDeadline: new Date('2024-05-15'),
        registrationDeadline: new Date('2024-06-01'),
        description: 'Annual technology conference featuring the latest innovations',
        website: 'https://techconf2024.com',
        settings: {
          followup_intervals: {
            "Stage1": 7,
            "Stage2": 3
          },
          max_attempts: {
            "Stage1": 6,
            "Stage2": 6
          },
          skip_weekends: true,
          smtp_default_id: null,
          timezone: "America/Los_Angeles",
          working_hours: {
            start: "09:00",
            end: "17:00"
          }
        },
        isActive: true
      }
    });

    const conference2 = await Conference.findOrCreate({
      where: { id: 'conf-2' },
      defaults: {
        id: 'conf-2',
        name: 'AI Summit 2024',
        venue: 'Tech Hub, New York',
        startDate: new Date('2024-08-20'),
        endDate: new Date('2024-08-22'),
        primaryContactUserId: teamLeadUser[0].id,
        currency: 'USD',
        abstractDeadline: new Date('2024-07-20'),
        registrationDeadline: new Date('2024-08-05'),
        description: 'Artificial Intelligence and Machine Learning summit',
        website: 'https://aisummit2024.com',
        settings: {
          followup_intervals: {
            "Stage1": 5,
            "Stage2": 2
          },
          max_attempts: {
            "Stage1": 8,
            "Stage2": 4
          },
          skip_weekends: false,
          smtp_default_id: null,
          timezone: "America/New_York",
          working_hours: {
            start: "08:00",
            end: "18:00"
          }
        },
        isActive: true
      }
    });

    console.log('✅ Conferences created with settings');

    // 4. Email templates are now managed through the UI

    // Email templates are now managed through the UI
    // No demo templates are created by default
    console.log('📧 Email templates will be created through the UI');

    // 5. Create Sample Clients
    const clients = [
      {
        id: uuidv4(),
        name: 'Dr. Sarah Johnson',
        email: 'sarah.johnson@university.edu',
        phone: '+1-555-0101',
        country: 'United States',
        company: 'Stanford University',
        position: 'Professor',
        status: 'Lead',
        conferenceId: conference1[0].id,
        ownerUserId: memberUser[0].id,
        source: 'Website',
        notes: 'Interested in AI research track'
      },
      {
        id: uuidv4(),
        name: 'Prof. Michael Chen',
        email: 'm.chen@mit.edu',
        phone: '+1-555-0102',
        country: 'United States',
        company: 'MIT',
        position: 'Research Director',
        status: 'Abstract Submitted',
        conferenceId: conference1[0].id,
        ownerUserId: memberUser[0].id,
        source: 'Referral',
        notes: 'Submitted abstract on machine learning'
      },
      {
        id: uuidv4(),
        name: 'Dr. Emma Wilson',
        email: 'e.wilson@cambridge.ac.uk',
        phone: '+44-20-7946-0958',
        country: 'United Kingdom',
        company: 'University of Cambridge',
        position: 'Senior Lecturer',
        status: 'Registered',
        conferenceId: conference1[0].id,
        ownerUserId: teamLeadUser[0].id,
        source: 'Email Campaign',
        notes: 'Fully registered and paid'
      },
      {
        id: uuidv4(),
        name: 'Dr. Ahmed Hassan',
        email: 'a.hassan@cairo.edu.eg',
        phone: '+20-2-3567-8901',
        country: 'Egypt',
        company: 'Cairo University',
        position: 'Assistant Professor',
        status: 'Lead',
        conferenceId: conference2[0].id,
        ownerUserId: memberUser[0].id,
        source: 'Website',
        notes: 'Interested in AI applications in healthcare'
      }
    ];

    for (const client of clients) {
      await Client.findOrCreate({
        where: { id: client.id },
        defaults: client
      });
    }

    console.log('✅ Sample clients created');

    // 6. Create Follow-up Jobs
    const followupJobs = [
      {
        id: uuidv4(),
        clientId: clients[0].id,
        conferenceId: conference1[0].id,
        stage: 'abstract_submission',
        followUpCount: 0,
        maxFollowUps: 6,
        nextSendAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        status: 'active',
        paused: false,
        skipWeekends: true,
        customInterval: 7,
        createdBy: ceoUser[0].id
      },
      {
        id: uuidv4(),
        clientId: clients[1].id,
        conferenceId: conference1[0].id,
        stage: 'registration',
        followUpCount: 0,
        maxFollowUps: 6,
        nextSendAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
        status: 'active',
        paused: false,
        skipWeekends: true,
        customInterval: 3,
        createdBy: ceoUser[0].id
      }
    ];

    for (const job of followupJobs) {
      await FollowUpJob.findOrCreate({
        where: { id: job.id },
        defaults: job
      });
    }

    console.log('✅ Follow-up jobs created');

    // 7. Create Sample SMTP Account
    const smtpAccount = await EmailAccount.findOrCreate({
      where: { email: 'noreply@techconf2024.com' },
      defaults: {
        id: uuidv4(),
        name: 'Tech Conference 2024 SMTP',
        email: 'noreply@techconf2024.com',
        type: 'smtp',
        smtpHost: 'smtp.gmail.com',
        smtpPort: 587,
        smtpUsername: 'noreply@techconf2024.com',
        smtpPassword: 'your-app-password',
        smtpSecure: true,
        smtpAuth: true,
        isDefault: true,
        createdBy: ceoUser[0].id,
        conferenceId: conference1[0].id,
        syncStatus: 'disconnected'
      }
    });

    console.log('✅ SMTP account created');

    // 8. Sample campaigns are now created through the UI
    console.log('📢 Campaigns will be created through the UI');

    console.log('🎉 Enhanced data seeding completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   👥 Users: 3 (CEO, TeamLead, Member)`);
    console.log(`   🏢 Conferences: 2`);
    console.log(`   👤 Clients: 4`);
    console.log(`   📧 Templates: 0 (Create through UI)`);
    console.log(`   🔄 Follow-up Jobs: 2`);
    console.log(`   📮 SMTP Account: 1`);
    console.log(`   📢 Campaigns: 0 (Create through UI)`);

  } catch (error) {
    console.error('❌ Enhanced seeding failed:', error);
    throw error;
  }
};

module.exports = { seedEnhancedData };
