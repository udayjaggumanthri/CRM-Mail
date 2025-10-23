import axios from 'axios';

// Configure axios defaults
axios.defaults.baseURL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
axios.defaults.headers.common['Content-Type'] = 'application/json';

// Add request interceptor for authentication
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// API Service class
class ApiService {
  // Authentication APIs
  async login(email, password) {
    const response = await axios.post('/api/auth/login', { email, password });
    return response.data;
  }

  async getProfile() {
    const response = await axios.get('/api/auth/me');
    return response.data;
  }

  async logout() {
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
  }

  // Dashboard APIs
  async getDashboard() {
    const response = await axios.get('/api/dashboard');
    return response.data;
  }

  async getDashboardStats(params = {}) {
    const response = await axios.get('/api/dashboard/stats', { params });
    return response.data;
  }

  async getDashboardKPIs(params = {}) {
    const response = await axios.get('/api/dashboard/kpis', { params });
    return response.data;
  }

  // Analytics APIs
  async getCEODashboard() {
    const response = await axios.get('/api/analytics/ceo-dashboard');
    return response.data;
  }

  async getOrganizationAnalytics() {
    const response = await axios.get('/api/analytics/organizations');
    return response.data;
  }

  async getConferenceAnalytics(conferenceId) {
    const response = await axios.get(`/api/analytics/conferences/${conferenceId}`);
    return response.data;
  }

  async getEmailAnalytics(params = {}) {
    const response = await axios.get('/api/analytics/emails', { params });
    return response.data;
  }

  async getClientAnalytics(params = {}) {
    const response = await axios.get('/api/analytics/clients', { params });
    return response.data;
  }

  async exportAnalytics(type, format = 'json', params = {}) {
    const response = await axios.get('/api/analytics/export', {
      params: { type, format, ...params },
      responseType: format === 'csv' ? 'blob' : 'json'
    });
    return response.data;
  }

  // Client APIs
  async getClients(params = {}) {
    const response = await axios.get('/api/clients', { params });
    return response.data;
  }

  async getClient(id) {
    const response = await axios.get(`/api/clients/${id}`);
    return response.data;
  }

  async createClient(clientData) {
    const response = await axios.post('/api/clients', clientData);
    return response.data;
  }

  async updateClient(id, clientData) {
    const response = await axios.put(`/api/clients/${id}`, clientData);
    return response.data;
  }

  async deleteClient(id) {
    const response = await axios.delete(`/api/clients/${id}`);
    return response.data;
  }

  // Conference APIs
  async getConferences(params = {}) {
    const response = await axios.get('/api/conferences', { params });
    return response.data;
  }

  async getConference(id) {
    const response = await axios.get(`/api/conferences/${id}`);
    return response.data;
  }

  async createConference(conferenceData) {
    const response = await axios.post('/api/conferences', conferenceData);
    return response.data;
  }

  async updateConference(id, conferenceData) {
    const response = await axios.put(`/api/conferences/${id}`, conferenceData);
    return response.data;
  }

  async deleteConference(id) {
    const response = await axios.delete(`/api/conferences/${id}`);
    return response.data;
  }

  // Email APIs
  async getEmails(params = {}) {
    const response = await axios.get('/api/emails', { params });
    return response.data;
  }

  async getEmail(id) {
    const response = await axios.get(`/api/emails/${id}`);
    return response.data;
  }

  async sendEmail(emailData) {
    const response = await axios.post('/api/emails/send', emailData);
    return response.data;
  }

  async getEmailLogs(params = {}) {
    const response = await axios.get('/api/email-logs', { params });
    return response.data;
  }

  // Template APIs
  async getTemplates(params = {}) {
    const response = await axios.get('/api/templates', { params });
    return response.data;
  }

  async getTemplate(id) {
    const response = await axios.get(`/api/templates/${id}`);
    return response.data;
  }

  async createTemplate(templateData) {
    const response = await axios.post('/api/templates', templateData);
    return response.data;
  }

  async updateTemplate(id, templateData) {
    const response = await axios.put(`/api/templates/${id}`, templateData);
    return response.data;
  }

  async deleteTemplate(id) {
    const response = await axios.delete(`/api/templates/${id}`);
    return response.data;
  }

  async renderTemplate(id, data) {
    const response = await axios.post(`/api/templates/${id}/render`, { data });
    return response.data;
  }

  async previewTemplate(id, sampleData) {
    const response = await axios.post(`/api/templates/${id}/preview`, { sampleData });
    return response.data;
  }

  async getTemplateVariables(id) {
    const response = await axios.get(`/api/templates/${id}/variables`);
    return response.data;
  }

  // SMTP APIs
  async getSMTPAccounts() {
    const response = await axios.get('/api/smtp-accounts');
    return response.data;
  }

  async getSMTPAccount(id) {
    const response = await axios.get(`/api/smtp/accounts/${id}`);
    return response.data;
  }

  async createSMTPAccount(smtpData) {
    const response = await axios.post('/api/smtp/accounts', smtpData);
    return response.data;
  }

  async updateSMTPAccount(id, smtpData) {
    const response = await axios.put(`/api/smtp/accounts/${id}`, smtpData);
    return response.data;
  }

  async deleteSMTPAccount(id) {
    const response = await axios.delete(`/api/smtp/accounts/${id}`);
    return response.data;
  }

  async testSMTPAccount(id) {
    const response = await axios.post(`/api/smtp/accounts/${id}/test`);
    return response.data;
  }

  async getSMTPHealth(id) {
    const response = await axios.get(`/api/smtp/accounts/${id}/health`);
    return response.data;
  }

  // Follow-up APIs
  async getFollowUpJobs(params = {}) {
    const response = await axios.get('/api/follow-up-jobs', { params });
    return response.data;
  }

  async createFollowUpJob(jobData) {
    const response = await axios.post('/api/follow-up-jobs', jobData);
    return response.data;
  }

  async pauseFollowUpJob(id) {
    const response = await axios.post(`/api/follow-up-jobs/${id}/pause`);
    return response.data;
  }

  async resumeFollowUpJob(id) {
    const response = await axios.post(`/api/follow-up-jobs/${id}/resume`);
    return response.data;
  }

  async getFollowUpStatistics() {
    const response = await axios.get('/api/follow-up-jobs/statistics');
    return response.data;
  }

  // Campaign APIs
  async getCampaigns(params = {}) {
    const response = await axios.get('/api/campaigns', { params });
    return response.data;
  }

  async getCampaign(id) {
    const response = await axios.get(`/api/campaigns/${id}`);
    return response.data;
  }

  async createCampaign(campaignData) {
    const response = await axios.post('/api/campaigns', campaignData);
    return response.data;
  }

  async updateCampaign(id, campaignData) {
    const response = await axios.put(`/api/campaigns/${id}`, campaignData);
    return response.data;
  }

  async deleteCampaign(id) {
    const response = await axios.delete(`/api/campaigns/${id}`);
    return response.data;
  }

  async getCampaignStats() {
    const response = await axios.get('/api/campaigns/stats');
    return response.data;
  }

  // Notification APIs
  async getNotifications(params = {}) {
    const response = await axios.get('/api/notifications', { params });
    return response.data;
  }

  async sendNotification(notificationData) {
    const response = await axios.post('/api/notifications/send', notificationData);
    return response.data;
  }

  async markNotificationAsRead(id) {
    const response = await axios.post(`/api/notifications/${id}/read`);
    return response.data;
  }

  async markAllNotificationsAsRead() {
    const response = await axios.post('/api/notifications/read-all');
    return response.data;
  }

  async getNotificationStatistics() {
    const response = await axios.get('/api/notifications/statistics');
    return response.data;
  }

  // Compliance APIs
  async getComplianceReports(params = {}) {
    const response = await axios.get('/api/compliance/reports', { params });
    return response.data;
  }

  async getAuditLogs(params = {}) {
    const response = await axios.get('/api/compliance/audit-logs', { params });
    return response.data;
  }

  async getSecurityHealth() {
    const response = await axios.get('/api/security/health');
    return response.data;
  }

  // GDPR APIs
  async giveGDPRConsent(consentData) {
    const response = await axios.post('/api/compliance/gdpr/consent', consentData);
    return response.data;
  }

  async withdrawGDPRConsent(withdrawalData) {
    const response = await axios.post('/api/compliance/gdpr/withdraw', withdrawalData);
    return response.data;
  }

  async exportGDPRData(clientId) {
    const response = await axios.post('/api/compliance/gdpr/export', { clientId });
    return response.data;
  }

  async deleteGDPRData(clientId, reason) {
    const response = await axios.post('/api/compliance/gdpr/delete', { clientId, reason });
    return response.data;
  }

  // CAN-SPAM APIs
  async checkCANSPAMCompliance(emailData) {
    const response = await axios.post('/api/compliance/can-spam/check', { emailData });
    return response.data;
  }

  // Unsubscribe APIs
  async handleUnsubscribe(token, reason, method) {
    const response = await axios.post('/api/compliance/unsubscribe', { token, reason, method });
    return response.data;
  }

  async generateUnsubscribeLink(clientId, emailId, baseUrl) {
    const response = await axios.post('/api/compliance/unsubscribe/generate-link', {
      clientId, emailId, baseUrl
    });
    return response.data;
  }

  // System APIs
  async getSystemStatus() {
    const response = await axios.get('/api/system/status');
    return response.data;
  }

  async getSystemPerformance() {
    const response = await axios.get('/api/system/performance');
    return response.data;
  }

  async optimizeSystem(action) {
    const response = await axios.post('/api/system/optimize', { action });
    return response.data;
  }

  // Real-time APIs
  async startRealtimeSync() {
    const response = await axios.post('/api/realtime/start');
    return response.data;
  }

  async stopRealtimeSync() {
    const response = await axios.post('/api/realtime/stop');
    return response.data;
  }

  async getRealtimeStatus() {
    const response = await axios.get('/api/realtime/status');
    return response.data;
  }

  // IMAP APIs
  async getIMAPStatus() {
    const response = await axios.get('/api/inbound/status');
    return response.data;
  }

  async startIMAPPolling() {
    const response = await axios.post('/api/inbound/polling');
    return response.data;
  }

  async stopIMAPPolling() {
    const response = await axios.delete('/api/inbound/polling');
    return response.data;
  }

  // Email sync APIs
  async syncEmails() {
    const response = await axios.post('/api/emails/sync');
    return response.data;
  }

  // Utility methods
  async downloadFile(url, filename) {
    const response = await axios.get(url, { responseType: 'blob' });
    const blob = new Blob([response.data]);
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(downloadUrl);
  }

  // Error handling
  handleError(error) {
    if (error.response) {
      // Server responded with error status
      return {
        message: error.response.data?.error || 'An error occurred',
        status: error.response.status,
        data: error.response.data
      };
    } else if (error.request) {
      // Request was made but no response received
      return {
        message: 'Network error - please check your connection',
        status: 0,
        data: null
      };
    } else {
      // Something else happened
      return {
        message: error.message || 'An unexpected error occurred',
        status: 0,
        data: null
      };
    }
  }
}

// Create and export singleton instance
const apiService = new ApiService();
export default apiService;
