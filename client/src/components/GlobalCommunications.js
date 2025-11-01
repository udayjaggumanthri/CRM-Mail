import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from 'react-query';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { Mail, Reply, Search, Funnel as FunnelIcon, Calendar as CalendarIcon } from 'lucide-react';

const GlobalCommunications = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Enforce CEO-only access without conditional hooks
  useEffect(() => {
    if (user && user.role !== 'CEO') {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const isCEO = user?.role === 'CEO';

  const [searchTerm, setSearchTerm] = useState('');
  const [conferenceFilter, setConferenceFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [showReplyModal, setShowReplyModal] = useState(false);
  const [replyData, setReplyData] = useState({
    to: '',
    subject: '',
    body: '',
    clientId: null,
    conferenceId: null
  });

  const { data: emailsData, isLoading } = useQuery(
    ['global-communications', searchTerm, conferenceFilter, dateFilter, statusFilter],
    async () => {
      const params = new URLSearchParams();
      params.append('folder', 'all');
      params.append('limit', '100');
      if (searchTerm) params.append('search', searchTerm);
      if (conferenceFilter) params.append('conferenceId', conferenceFilter);
      if (dateFilter) params.append('startDate', dateFilter);
      if (statusFilter !== 'all') params.append('filter', statusFilter);
      const response = await axios.get(`/api/emails?${params.toString()}`);
      return response.data;
    }
  );

  const { data: conferences } = useQuery('conferences', async () => {
    const response = await axios.get('/api/conferences');
    return response.data;
  });

  const sendReplyMutation = useMutation(
    async (emailData) => {
      const response = await axios.post('/api/emails/send', emailData);
      return response.data;
    },
    {
      onSuccess: () => {
        toast.success('Email sent successfully');
        setShowReplyModal(false);
        setReplyData({ to: '', subject: '', body: '', clientId: null, conferenceId: null });
      },
      onError: (error) => {
        toast.error(error.response?.data?.error || 'Failed to send email');
      }
    }
  );

  const handleReply = (email) => {
    const clientId = email.clientId || email.client?.id || null;
    const conferenceId = email.conferenceId || email.conference?.id || null;
    const replySubject = email.subject?.startsWith('Re:') ? email.subject : `Re: ${email.subject || ''}`;
    setReplyData({
      to: email.from || email.to || '',
      subject: replySubject,
      body: `\n\n--- Original Message ---\nFrom: ${email.from}\nSubject: ${email.subject}\n\n${email.body || email.bodyText || ''}`,
      clientId,
      conferenceId
    });
    setShowReplyModal(true);
  };

  const handleSendReply = (e) => {
    e.preventDefault();
    sendReplyMutation.mutate({
      emailAccountId: replyData.emailAccountId || null,
      to: replyData.to,
      subject: replyData.subject,
      body: replyData.body,
      bodyHtml: replyData.body.replace(/\n/g, '<br>'),
      clientId: replyData.clientId,
      conferenceId: replyData.conferenceId,
      parentId: selectedEmail?.id,
      parentType: 'email'
    });
  };

  const emails = emailsData?.emails || [];

  if (!isCEO) return null;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Global Communications</h1>
          <p className="text-gray-600">View and manage all email communications across all clients</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search emails..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <select
              value={conferenceFilter}
              onChange={(e) => setConferenceFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All Conferences</option>
              {conferences?.map(conf => (
                <option key={conf.id} value={conf.id}>{conf.name}</option>
              ))}
            </select>

            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">All Status</option>
              <option value="sent">Sent</option>
              <option value="bounced">Bounced</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading communications...</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">From/To</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subject</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {emails.map((email) => (
                  <tr key={email.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{email.from || email.to}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{email.subject || 'No Subject'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{email.client?.name || 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(email.date || email.createdAt).toLocaleDateString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        email.status === 'sent' ? 'bg-green-100 text-green-800' :
                        email.status === 'bounced' ? 'bg-red-100 text-red-800' :
                        email.status === 'failed' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {email.status || 'sent'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => { setSelectedEmail(email); handleReply(email); }}
                        className="text-blue-600 hover:text-blue-900 flex items-center gap-1"
                      >
                        <Reply className="w-4 h-4" />
                        Reply/Intervene
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {showReplyModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full">
              <div className="p-6">
                <h2 className="text-2xl font-bold mb-4">Reply/Intervene</h2>
                <form onSubmit={handleSendReply}>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">To</label>
                      <input
                        type="email"
                        value={replyData.to}
                        onChange={(e) => setReplyData({ ...replyData, to: e.target.value })}
                        required
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
                      <input
                        type="text"
                        value={replyData.subject}
                        onChange={(e) => setReplyData({ ...replyData, subject: e.target.value })}
                        required
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Message</label>
                      <textarea
                        value={replyData.body}
                        onChange={(e) => setReplyData({ ...replyData, body: e.target.value })}
                        rows={10}
                        required
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end space-x-3 mt-6">
                    <button
                      type="button"
                      onClick={() => setShowReplyModal(false)}
                      className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={sendReplyMutation.isLoading}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      {sendReplyMutation.isLoading ? 'Sending...' : 'Send Reply'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GlobalCommunications;


