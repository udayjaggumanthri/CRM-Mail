const { EmailTemplate, Client, Conference, User, Organization } = require('../models');

class TemplateEngine {
  constructor() {
    this.variablePattern = /\{\{([^}]+)\}\}/g;
    this.conditionalPattern = /\{\{#if\s+([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
    this.loopPattern = /\{\{#each\s+([^}]+)\}\}([\s\S]*?)\{\{\/each\}\}/g;
  }

  /**
   * Extract all variables from template content
   * @param {string} content - Template content
   * @returns {Array} Array of variable names
   */
  extractVariables(content) {
    const variables = new Set();
    let match;
    
    while ((match = this.variablePattern.exec(content)) !== null) {
      variables.add(match[1].trim());
    }
    
    return Array.from(variables);
  }

  /**
   * Get available variables for a template
   * @param {string} templateId - Template ID
   * @param {string} clientId - Client ID
   * @param {string} conferenceId - Conference ID
   * @returns {Object} Available variables
   */
  async getAvailableVariables(templateId, clientId, conferenceId) {
    try {
      const variables = {};
      
      // Get client data
      if (clientId) {
        const client = await Client.findByPk(clientId);
        
        if (client) {
          variables.client = {
            id: client.id,
            name: `${client.firstName} ${client.lastName}`,
            firstName: client.firstName,
            lastName: client.lastName,
            email: client.email,
            phone: client.phone,
            country: client.country,
            organization: client.organization,
            position: client.position,
            title: client.title,
            department: client.department,
            jobTitle: client.jobTitle,
            currentStage: client.currentStage,
            status: client.status,
            priority: client.priority,
            tags: client.tags || [],
            customFields: client.customFields || {}
          };
        }
      }

      // Get conference data
      if (conferenceId) {
        const conference = await Conference.findByPk(conferenceId);
        
        if (conference) {
          variables.conference = {
            id: conference.id,
            name: conference.name,
            venue: conference.venue,
            startDate: conference.startDate,
            endDate: conference.endDate,
            description: conference.description,
            website: conference.website,
            abstractDeadline: conference.abstractDeadline,
            registrationDeadline: conference.registrationDeadline,
            currency: conference.currency,
            status: conference.status,
            location: conference.location || {},
            contactInfo: conference.contactInfo || {},
            primaryContact: conference.primaryContact,
            assignedTeamLead: conference.assignedTeamLead,
            organization: conference.organization
          };
        }
      }

      // Add system variables
      variables.system = {
        currentDate: new Date().toLocaleDateString(),
        currentTime: new Date().toLocaleTimeString(),
        currentYear: new Date().getFullYear(),
        currentMonth: new Date().getMonth() + 1,
        currentDay: new Date().getDate(),
        timezone: 'UTC'
      };

      // Add organization data
      if (variables.client?.organization) {
        variables.organization = variables.client.organization;
      } else if (variables.conference?.organization) {
        variables.organization = variables.conference.organization;
      }

      return variables;
    } catch (error) {
      console.error('Error getting available variables:', error);
      return {};
    }
  }

  /**
   * Render template with variables
   * @param {string} templateId - Template ID
   * @param {string} clientId - Client ID
   * @param {string} conferenceId - Conference ID
   * @returns {Object} Rendered template
   */
  async renderTemplate(templateId, clientId, conferenceId) {
    try {
      const template = await EmailTemplate.findByPk(templateId);
      if (!template) {
        throw new Error('Template not found');
      }

      const variables = await this.getAvailableVariables(templateId, clientId, conferenceId);
      
      const renderedTemplate = {
        id: template.id,
        name: template.name,
        stage: template.stage,
        subject: this.renderContent(template.subject, variables),
        bodyHtml: this.renderContent(template.bodyHtml, variables),
        bodyText: this.renderContent(template.bodyText, variables),
        variables: this.extractVariables(template.bodyHtml + template.bodyText),
        attachments: template.attachments || []
      };

      return renderedTemplate;
    } catch (error) {
      console.error('Error rendering template:', error);
      throw error;
    }
  }

  /**
   * Render content with variables
   * @param {string} content - Content to render
   * @param {Object} variables - Variables to substitute
   * @returns {string} Rendered content
   */
  renderContent(content, variables) {
    if (!content) return '';

    let rendered = content;

    // Replace simple variables
    rendered = rendered.replace(this.variablePattern, (match, variable) => {
      const value = this.getVariableValue(variable.trim(), variables);
      return value !== undefined ? value : match;
    });

    // Handle conditional statements
    rendered = rendered.replace(this.conditionalPattern, (match, condition, content) => {
      const conditionResult = this.evaluateCondition(condition, variables);
      return conditionResult ? content : '';
    });

    // Handle loops
    rendered = rendered.replace(this.loopPattern, (match, arrayPath, content) => {
      const array = this.getVariableValue(arrayPath.trim(), variables);
      if (Array.isArray(array)) {
        return array.map(item => this.renderContent(content, { ...variables, item })).join('');
      }
      return '';
    });

    return rendered;
  }

  /**
   * Get variable value from nested object
   * @param {string} path - Variable path (e.g., 'client.name')
   * @param {Object} variables - Variables object
   * @returns {*} Variable value
   */
  getVariableValue(path, variables) {
    const keys = path.split('.');
    let value = variables;
    
    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return undefined;
      }
    }
    
    return value;
  }

  /**
   * Evaluate condition for conditional statements
   * @param {string} condition - Condition to evaluate
   * @param {Object} variables - Variables object
   * @returns {boolean} Condition result
   */
  evaluateCondition(condition, variables) {
    // Simple condition evaluation
    // Supports: variable, variable == value, variable != value
    const trimmedCondition = condition.trim();
    
    if (trimmedCondition.includes('==')) {
      const [left, right] = trimmedCondition.split('==').map(s => s.trim());
      const leftValue = this.getVariableValue(left, variables);
      const rightValue = this.getVariableValue(right, variables) || right.replace(/['"]/g, '');
      return leftValue == rightValue;
    }
    
    if (trimmedCondition.includes('!=')) {
      const [left, right] = trimmedCondition.split('!=').map(s => s.trim());
      const leftValue = this.getVariableValue(left, variables);
      const rightValue = this.getVariableValue(right, variables) || right.replace(/['"]/g, '');
      return leftValue != rightValue;
    }
    
    // Simple truthy check
    const value = this.getVariableValue(trimmedCondition, variables);
    return Boolean(value);
  }

  /**
   * Validate template variables
   * @param {string} templateId - Template ID
   * @param {Object} variables - Variables to validate
   * @returns {Object} Validation result
   */
  async validateTemplateVariables(templateId, variables) {
    try {
      const template = await EmailTemplate.findByPk(templateId);
      if (!template) {
        return { valid: false, error: 'Template not found' };
      }

      const requiredVariables = this.extractVariables(template.bodyHtml + template.bodyText);
      const missingVariables = [];
      const availableVariables = Object.keys(variables);

      for (const variable of requiredVariables) {
        if (!availableVariables.includes(variable.split('.')[0])) {
          missingVariables.push(variable);
        }
      }

      return {
        valid: missingVariables.length === 0,
        missingVariables,
        requiredVariables,
        availableVariables
      };
    } catch (error) {
      console.error('Error validating template variables:', error);
      return { valid: false, error: error.message };
    }
  }

  /**
   * Preview template with sample data
   * @param {string} templateId - Template ID
   * @param {Object} sampleData - Sample data for preview
   * @returns {Object} Preview result
   */
  async previewTemplate(templateId, sampleData = {}) {
    try {
      const template = await EmailTemplate.findByPk(templateId);
      if (!template) {
        throw new Error('Template not found');
      }

      const defaultSampleData = {
        client: {
          name: 'John Doe',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
          organization: 'Example Corp',
          country: 'United States'
        },
        conference: {
          name: 'Sample Conference 2024',
          venue: 'Convention Center',
          startDate: '2024-06-15',
          endDate: '2024-06-17',
          website: 'https://example.com'
        },
        organization: {
          name: 'Sample Organization',
          domain: 'example.com'
        },
        system: {
          currentDate: new Date().toLocaleDateString(),
          currentTime: new Date().toLocaleTimeString()
        }
      };

      const variables = { ...defaultSampleData, ...sampleData };
      
      return {
        subject: this.renderContent(template.subject, variables),
        bodyHtml: this.renderContent(template.bodyHtml, variables),
        bodyText: this.renderContent(template.bodyText, variables),
        variables: this.extractVariables(template.bodyHtml + template.bodyText)
      };
    } catch (error) {
      console.error('Error previewing template:', error);
      throw error;
    }
  }
}

module.exports = TemplateEngine;
