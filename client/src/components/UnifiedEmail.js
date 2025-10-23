import React, { useState } from 'react';
import { useQuery, useMutation } from 'react-query';
import axios from 'axios';
import toast from 'react-hot-toast';
import useRealtimeEmail from '../hooks/useRealtimeEmail';
import { useAuth } from '../contexts/AuthContext';
import {
  Mail,
  Send,
  Inbox,
  Archive,
  Trash2,
  Search,
  Plus,
  RefreshCw,
  Star,
  Reply,
  Forward,
  CheckCircle,
  AlertCircle,
  X,
  Pencil,
  File,
  Paperclip
} from 'lucide-react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';

const UnifiedEmail = () => {
  const { user } = useAuth();
  const [activeFolder, setActiveFolder] = useState('inbox');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [showCompose, setShowCompose] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    fromEmail: '',
    toEmail: '',
    startDate: '',
    endDate: ''
  });
  
  const { 
    isConnected, 
    newEmailsCount, 
    triggerSync, 
    clearNewEmailsCount 
  } = useRealtimeEmail(user?.id);

  const [composeData, setComposeData] = useState({
    to: '',
    cc: '',
    bcc: '',
    subject: '',
    body: '',
    attachments: []
  });

  const { data: emailsData, isLoading, refetch } = useQuery(
    ['emails', activeFolder, searchTerm, currentPage, filters], 
    async () => {
      const params = new URLSearchParams();
      if (activeFolder) {
        params.append('folder', activeFolder);
      }
      if (searchTerm) {
        params.append('search', searchTerm);
      }
      params.append('page', currentPage);
      params.append('limit', 50);
      
      if (filters.fromEmail) {
        params.append('fromEmail', filters.fromEmail);
      }
      if (filters.toEmail) {
        params.append('toEmail', filters.toEmail);
      }
      if (filters.startDate) {
        params.append('startDate', filters.startDate);
      }
      if (filters.endDate) {
        params.append('endDate', filters.endDate);
      }
      
      const response = await axios.get(`/api/emails?${params.toString()}`);
      return response.data;
    }
  );

  const emails = React.useMemo(() => {
    if (!emailsData) return [];
    if (Array.isArray(emailsData)) return emailsData;
    if (emailsData?.emails) return emailsData.emails;
    return [];
  }, [emailsData]);

  const { data: templates = [] } = useQuery('templates', async () => {
    const response = await axios.get('/api/templates');
    return response.data;
  });

  const { data: clients = [] } = useQuery('clients-for-email', async () => {
    const response = await axios.get('/api/clients/for-email');
    return response.data;
  });

  const { data: emailAccounts = [] } = useQuery('email-accounts', async () => {
    const response = await axios.get('/api/email-accounts');
    return response.data;
  });

  const sendEmailMutation = useMutation(async (emailData) => {
    const response = await axios.post('/api/emails/send', emailData);
    return response.data;
  }, {
    onSuccess: () => {
      toast.success('Email sent successfully');
      setShowCompose(false);
      resetComposeData();
      refetch();
    },
    onError: (error) => {
      const errorMessage = error.response?.data?.error || error.response?.data?.details || 'Failed to send email';
      toast.error(errorMessage);
    }
  });

  const syncEmailMutation = useMutation(async () => {
    const response = await axios.post('/api/emails/sync', { daysBack: 365 });
    return response.data;
  }, {
    onSuccess: (data) => {
      toast.success(`Synced ${data.totalSynced} emails`);
      refetch();
      setIsSyncing(false);
    },
    onError: (error) => {
      toast.error('Failed to sync emails');
      setIsSyncing(false);
    }
  });

  const resetComposeData = () => {
    setComposeData({
      to: '',
      cc: '',
      bcc: '',
      subject: '',
      body: '',
      attachments: []
    });
  };

  const handleSync = async () => {
    setIsSyncing(true);
    syncEmailMutation.mutate();
  };

  const handleSendEmail = () => {
    if (!composeData.to || !composeData.subject) {
      toast.error('Please fill in recipient and subject');
      return;
    }
    
    if (!emailAccounts || emailAccounts.length === 0) {
      toast.error('No email account configured. Please add an email account first.');
      return;
    }
    
    const defaultAccount = emailAccounts[0];
    
    sendEmailMutation.mutate({
      ...composeData,
      emailAccountId: defaultAccount.id,
      bodyHtml: composeData.body,
      bodyText: composeData.body.replace(/<[^>]*>/g, '')
    });
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (hours < 24) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } else if (hours < 168) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const getInitials = (email) => {
    if (!email) return '?';
    const parts = email.split('@')[0].split('.');
    return parts.map(p => p[0]?.toUpperCase()).join('').slice(0, 2) || '?';
  };

  const folders = [
    { id: 'inbox', icon: Inbox, label: 'Inbox', count: activeFolder === 'inbox' ? emails.length : 0 },
    { id: 'sent', icon: Send, label: 'Sent', count: activeFolder === 'sent' ? emails.length : 0 },
    { id: 'all', icon: Mail, label: 'All Mail', count: activeFolder === 'all' ? emails.length : 0 },
    { id: 'spam', icon: AlertCircle, label: 'Spam', count: activeFolder === 'spam' ? emails.length : 0 },
    { id: 'drafts', icon: File, label: 'Drafts', count: activeFolder === 'drafts' ? emails.length : 0 },
    { id: 'trash', icon: Trash2, label: 'Trash', count: 0 }
  ];

  const pagination = emailsData?.pagination || { total: 0, page: 1, pages: 0, hasMore: false };

  const handleFolderChange = (folderId) => {
    setActiveFolder(folderId);
    setCurrentPage(1);
  };

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
    setSelectedEmail(null);
  };

  const handleApplyFilters = () => {
    setCurrentPage(1);
    setShowFilters(false);
  };

  const handleResetFilters = () => {
    setFilters({
      fromEmail: '',
      toEmail: '',
      startDate: '',
      endDate: ''
    });
    setCurrentPage(1);
  };

  const filteredEmails = emails;

  return (
    <div className="flex flex-col h-screen bg-white">
      <div className="flex-none border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center space-x-4">
            <Mail className="h-6 w-6 text-red-600" />
            <h1 className="text-xl font-normal text-gray-900">Mail</h1>
          </div>
          
          <div className="flex-1 max-w-2xl mx-8">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search mail"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-100 border-0 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {isConnected && (
              <div className="flex items-center text-xs text-green-600">
                <CheckCircle className="h-4 w-4 mr-1" />
                <span>Connected</span>
              </div>
            )}
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <RefreshCw className={`h-5 w-5 text-gray-600 ${isSyncing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-56 flex-none border-r border-gray-200 bg-white overflow-y-auto">
          <div className="p-4">
            <button
              onClick={() => setShowCompose(true)}
              className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors shadow-md"
            >
              <Pencil className="h-5 w-5" />
              <span className="font-medium">Compose</span>
            </button>
          </div>

          <nav className="px-2 space-y-1">
            {folders.map((folder) => {
              const Icon = folder.icon;
              const isActive = activeFolder === folder.id;
              return (
                <button
                  key={folder.id}
                  onClick={() => handleFolderChange(folder.id)}
                  className={`w-full flex items-center justify-between px-4 py-2 text-sm rounded-r-full transition-colors ${
                    isActive 
                      ? 'bg-red-100 text-red-900 font-medium' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <Icon className={`h-5 w-5 ${isActive ? 'text-red-600' : 'text-gray-500'}`} />
                    <span>{folder.label}</span>
                  </div>
                  {folder.count > 0 && (
                    <span className="text-xs text-gray-500">{folder.count}</span>
                  )}
                </button>
              );
            })}
          </nav>
          
          <div className="px-4 py-3 border-t border-gray-200 mt-4">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="w-full text-sm text-gray-600 hover:text-gray-900 flex items-center space-x-2"
            >
              <Search className="h-4 w-4" />
              <span>{showFilters ? 'Hide Filters' : 'Show Filters'}</span>
            </button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className={`${selectedEmail ? 'w-96' : 'flex-1'} border-r border-gray-200 bg-white flex flex-col overflow-hidden`}>
            
            {showFilters && (
              <div className="flex-none border-b border-gray-200 bg-gray-50 p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="From email..."
                    value={filters.fromEmail}
                    onChange={(e) => setFilters({...filters, fromEmail: e.target.value})}
                    className="px-3 py-2 text-sm border border-gray-300 rounded-md"
                  />
                  <input
                    type="text"
                    placeholder="To email..."
                    value={filters.toEmail}
                    onChange={(e) => setFilters({...filters, toEmail: e.target.value})}
                    className="px-3 py-2 text-sm border border-gray-300 rounded-md"
                  />
                  <input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => setFilters({...filters, startDate: e.target.value})}
                    className="px-3 py-2 text-sm border border-gray-300 rounded-md"
                  />
                  <input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => setFilters({...filters, endDate: e.target.value})}
                    className="px-3 py-2 text-sm border border-gray-300 rounded-md"
                  />
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={handleApplyFilters}
                    className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Apply Filters
                  </button>
                  <button
                    onClick={handleResetFilters}
                    className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                  >
                    Reset
                  </button>
                </div>
              </div>
            )}
            
            <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <RefreshCw className="h-8 w-8 text-gray-400 animate-spin" />
              </div>
            ) : filteredEmails.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-6">
                <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <Inbox className="h-12 w-12 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {activeFolder === 'inbox' ? 'Your inbox is empty' : `No ${activeFolder} emails`}
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  {activeFolder === 'inbox' 
                    ? 'When emails arrive, they\'ll appear here' 
                    : `You don't have any ${activeFolder} emails yet`}
                </p>
                <button
                  onClick={handleSync}
                  className="flex items-center space-x-2 px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span>Sync Emails</span>
                </button>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredEmails.map((email) => (
                  <div
                    key={email.id}
                    onClick={() => {
                      console.log('Selected email:', email);
                      console.log('Email body:', email.body);
                      console.log('Email bodyText:', email.bodyText);
                      setSelectedEmail(email);
                    }}
                    className={`flex items-start space-x-3 px-4 py-3 cursor-pointer hover:shadow-sm transition-all ${
                      selectedEmail?.id === email.id 
                        ? 'bg-blue-50 border-l-4 border-blue-600' 
                        : !email.isRead 
                          ? 'bg-white border-l-4 border-transparent' 
                          : 'bg-gray-50 border-l-4 border-transparent'
                    }`}
                  >
                    <div className={`flex-none w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
                      !email.isRead ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-700'
                    }`}>
                      {getInitials(email.from)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-sm truncate ${!email.isRead ? 'font-semibold text-gray-900' : 'font-normal text-gray-700'}`}>
                          {email.from?.split('<')[0].trim() || email.from}
                        </span>
                        <span className="text-xs text-gray-500 flex-none ml-2">
                          {formatDate(email.date)}
                        </span>
                      </div>
                      
                      <div className={`text-sm mb-1 truncate ${!email.isRead ? 'font-medium text-gray-900' : 'text-gray-700'}`}>
                        {email.subject || '(no subject)'}
                      </div>
                      
                      <div className="text-xs text-gray-500 truncate">
                        {email.bodyText?.substring(0, 100) || 'No preview available'}
                      </div>
                    </div>

                    {email.hasAttachments && (
                      <Paperclip className="h-4 w-4 text-gray-400 flex-none" />
                    )}
                  </div>
                ))}
              </div>
            )}
            </div>
            
            {pagination.pages > 1 && (
              <div className="flex-none border-t border-gray-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">
                    Page {pagination.page} of {pagination.pages} ({pagination.total} total)
                  </span>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage >= pagination.pages}
                      className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {selectedEmail && (
            <div className="flex-1 bg-white overflow-y-auto" style={{ display: 'block', minHeight: '100vh' }}>
              <div className="border-b border-gray-200 p-6">
                <div className="flex items-start justify-between mb-4">
                  <h2 className="text-2xl font-normal text-gray-900">
                    {selectedEmail.subject || '(no subject)'}
                  </h2>
                  <button
                    onClick={() => setSelectedEmail(null)}
                    className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <X className="h-5 w-5 text-gray-500" />
                  </button>
                </div>

                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-medium">
                    {getInitials(selectedEmail.from || 'Unknown')}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">
                      {selectedEmail.from?.split('<')[0].trim() || selectedEmail.from || 'Unknown Sender'}
                    </div>
                    <div className="text-xs text-gray-500">
                      to {selectedEmail.to || 'Unknown Recipient'}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    {selectedEmail.date ? new Date(selectedEmail.date).toLocaleString() : 'Unknown Date'}
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button className="flex items-center space-x-1 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors">
                    <Reply className="h-4 w-4" />
                    <span>Reply</span>
                  </button>
                  <button className="flex items-center space-x-1 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors">
                    <Forward className="h-4 w-4" />
                    <span>Forward</span>
                  </button>
                  <button className="flex items-center space-x-1 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors">
                    <Star className="h-4 w-4" />
                    <span>Star</span>
                  </button>
                </div>
              </div>

              <div className="p-6">
                {(() => {
                  const emailBody = selectedEmail.bodyHtml || selectedEmail.body || selectedEmail.bodyText;
                  console.log('Rendering email body:', emailBody ? 'Has content' : 'No content');
                  
                  if (emailBody) {
                    return (
                      <div 
                        className="prose prose-sm max-w-none text-gray-900"
                        dangerouslySetInnerHTML={{ __html: emailBody }}
                        style={{ 
                          wordWrap: 'break-word',
                          overflowWrap: 'break-word',
                          fontSize: '14px',
                          lineHeight: '1.6'
                        }}
                      />
                    );
                  } else {
                    return (
                      <div className="text-center py-12 text-gray-500">
                        <Mail className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                        <p>This email has no content</p>
                      </div>
                    );
                  }
                })()}
                
                {(() => {
                  try {
                    const attachments = Array.isArray(selectedEmail.attachments) 
                      ? selectedEmail.attachments 
                      : (typeof selectedEmail.attachments === 'string' ? JSON.parse(selectedEmail.attachments) : []);
                    
                    if (attachments && attachments.length > 0) {
                      return (
                        <div className="mt-6 pt-6 border-t border-gray-200">
                          <h3 className="text-sm font-medium text-gray-900 mb-3">
                            Attachments ({attachments.length})
                          </h3>
                          <div className="space-y-2">
                            {attachments.map((attachment, index) => (
                              <div key={index} className="flex items-center space-x-2 p-2 bg-gray-50 rounded-md">
                                <Mail className="h-4 w-4 text-gray-400" />
                                <span className="text-sm text-gray-700">{attachment.filename || `Attachment ${index + 1}`}</span>
                                {attachment.size && (
                                  <span className="text-xs text-gray-500">
                                    ({Math.round(attachment.size / 1024)} KB)
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }
                  } catch (e) {
                    return null;
                  }
                  return null;
                })()}
              </div>
            </div>
          )}
        </div>
      </div>

      <Transition appear show={showCompose} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowCompose(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-25" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-end justify-center p-0">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95 translate-y-full"
                enterTo="opacity-100 scale-100 translate-y-0"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100 translate-y-0"
                leaveTo="opacity-0 scale-95 translate-y-full"
              >
                <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-t-2xl bg-white shadow-xl transition-all">
                  <div className="bg-gray-100 px-6 py-4 flex items-center justify-between">
                    <Dialog.Title className="text-lg font-medium text-gray-900">
                      New Message
                    </Dialog.Title>
                    <button
                      onClick={() => setShowCompose(false)}
                      className="p-1 hover:bg-gray-200 rounded-full transition-colors"
                    >
                      <X className="h-5 w-5 text-gray-600" />
                    </button>
                  </div>

                  <div className="p-6 space-y-4">
                    <div className="border-b border-gray-200 pb-4 space-y-3">
                      <input
                        type="email"
                        placeholder="To"
                        value={composeData.to}
                        onChange={(e) => setComposeData({ ...composeData, to: e.target.value })}
                        className="w-full px-0 py-2 text-sm border-0 focus:ring-0 placeholder-gray-500"
                      />
                      <input
                        type="text"
                        placeholder="Subject"
                        value={composeData.subject}
                        onChange={(e) => setComposeData({ ...composeData, subject: e.target.value })}
                        className="w-full px-0 py-2 text-sm border-0 focus:ring-0 placeholder-gray-500"
                      />
                    </div>

                    <textarea
                      placeholder="Compose your message..."
                      value={composeData.body}
                      onChange={(e) => setComposeData({ ...composeData, body: e.target.value })}
                      rows={12}
                      className="w-full px-0 py-2 text-sm border-0 focus:ring-0 resize-none"
                    />

                    <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                      <button
                        onClick={handleSendEmail}
                        disabled={sendEmailMutation.isLoading}
                        className="flex items-center space-x-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
                      >
                        <Send className="h-4 w-4" />
                        <span>{sendEmailMutation.isLoading ? 'Sending...' : 'Send'}</span>
                      </button>
                    </div>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
};

export default UnifiedEmail;
