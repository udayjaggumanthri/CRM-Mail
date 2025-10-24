/**
 * Test Script to Verify Template Fix
 * 
 * This script helps verify that the template system is using
 * conference-assigned templates correctly.
 */

const { Conference, EmailTemplate } = require('./server/models');

async function testTemplateFix() {
  console.log('🧪 Testing Template Fix...\n');

  try {
    // Get a conference
    const conferences = await Conference.findAll({ limit: 1 });
    
    if (conferences.length === 0) {
      console.log('❌ No conferences found. Please create a conference first.');
      return;
    }

    const conference = conferences[0];
    console.log(`📋 Conference: ${conference.name}`);
    console.log(`   ID: ${conference.id}`);
    console.log(`   Initial Template ID: ${conference.initialTemplateId || 'NOT SET ⚠️'}`);
    console.log(`   Stage 1 Template ID: ${conference.stage1TemplateId || 'NOT SET ⚠️'}`);
    console.log(`   Stage 2 Template ID: ${conference.stage2TemplateId || 'NOT SET ⚠️'}`);
    console.log('');

    // Check templates
    const templates = await EmailTemplate.findAll({
      where: { isActive: true }
    });

    console.log(`📧 Found ${templates.length} active email templates:\n`);

    const templatesByStage = {
      initial_invitation: [],
      abstract_submission: [],
      registration: []
    };

    templates.forEach(t => {
      if (templatesByStage[t.stage]) {
        templatesByStage[t.stage].push(t);
      }
      console.log(`   ${t.stage === 'initial_invitation' ? '📨' : t.stage === 'abstract_submission' ? '📬' : '📮'} ${t.name}`);
      console.log(`      Stage: ${t.stage}`);
      console.log(`      ID: ${t.id}`);
      console.log(`      Active: ${t.isActive ? '✅' : '❌'}`);
      console.log('');
    });

    // Verify template assignment
    console.log('\n🔍 Verification:\n');

    let allGood = true;

    // Check Initial Template
    if (conference.initialTemplateId) {
      const template = await EmailTemplate.findByPk(conference.initialTemplateId);
      if (template) {
        console.log(`✅ Initial template assigned and found: ${template.name}`);
      } else {
        console.log(`❌ Initial template ID set but template not found!`);
        allGood = false;
      }
    } else {
      if (templatesByStage.initial_invitation.length > 0) {
        console.log(`⚠️  Initial template not assigned, but ${templatesByStage.initial_invitation.length} fallback(s) available`);
      } else {
        console.log(`❌ No initial template assigned and no fallbacks available!`);
        allGood = false;
      }
    }

    // Check Stage 1 Template
    if (conference.stage1TemplateId) {
      const template = await EmailTemplate.findByPk(conference.stage1TemplateId);
      if (template) {
        console.log(`✅ Stage 1 template assigned and found: ${template.name}`);
      } else {
        console.log(`❌ Stage 1 template ID set but template not found!`);
        allGood = false;
      }
    } else {
      if (templatesByStage.abstract_submission.length > 0) {
        console.log(`⚠️  Stage 1 template not assigned, but ${templatesByStage.abstract_submission.length} fallback(s) available`);
      } else {
        console.log(`❌ No Stage 1 template assigned and no fallbacks available!`);
        allGood = false;
      }
    }

    // Check Stage 2 Template
    if (conference.stage2TemplateId) {
      const template = await EmailTemplate.findByPk(conference.stage2TemplateId);
      if (template) {
        console.log(`✅ Stage 2 template assigned and found: ${template.name}`);
      } else {
        console.log(`❌ Stage 2 template ID set but template not found!`);
        allGood = false;
      }
    } else {
      if (templatesByStage.registration.length > 0) {
        console.log(`⚠️  Stage 2 template not assigned, but ${templatesByStage.registration.length} fallback(s) available`);
      } else {
        console.log(`❌ No Stage 2 template assigned and no fallbacks available!`);
        allGood = false;
      }
    }

    console.log('\n' + '='.repeat(60));
    if (allGood && conference.initialTemplateId && conference.stage1TemplateId && conference.stage2TemplateId) {
      console.log('✅ ALL GOOD! Conference has all templates assigned correctly.');
    } else if (allGood) {
      console.log('⚠️  PARTIALLY CONFIGURED: Some templates not assigned but fallbacks available.');
      console.log('   Recommendation: Assign specific templates to the conference for best results.');
    } else {
      console.log('❌ ISSUES FOUND: Please fix the problems listed above.');
    }
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Error running test:', error.message);
    console.error(error);
  }

  process.exit(0);
}

// Run the test
testTemplateFix();

