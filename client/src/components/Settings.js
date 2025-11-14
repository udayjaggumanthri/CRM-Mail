import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  Plus,
  Edit,
  Trash2,
  TestTube,
  Mail,
  Server,
  Users,
  Shield,
  Inbox,
  ChevronLeft,
  ChevronRight,
  CheckCircle2
} from 'lucide-react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import ImapSettings from './ImapSettings';

const deriveSecurityOption = (securityValue, secureFlag, fallback = 'tls') => {
  if (typeof securityValue === 'string' && securityValue.length > 0) {
    return securityValue;
  }
  if (secureFlag === false) {
    return 'none';
  }
  return fallback;
};

const boolFromSecurityOption = (option) => option !== 'none';

const mapAccountToFormData = (account = {}) => ({
  id: account.id,
  name: account.name || '',
  host: account.host || account.smtpHost || '',
  port: account.port || account.smtpPort || 587,
  security: deriveSecurityOption(account.security, account.smtpSecure),
  username: account.username || account.smtpUsername || '',
  password: account.password || account.smtpPassword || '',
  fromEmail: account.fromEmail || account.email || '',
  isSystem: Boolean(account.isSystem),
  allowUsers: account.allowUsers !== undefined ? Boolean(account.allowUsers) : true,
  type: account.type || 'both',
  imapHost: account.imapHost || '',
  imapPort: account.imapPort || 993,
  imapSecurity: deriveSecurityOption(account.imapSecurity, account.imapSecure, 'ssl'),
  imapUsername: account.imapUsername || account.smtpUsername || '',
  imapPassword: account.imapPassword || '',
  imapFolder: account.imapFolder || 'INBOX'
});

const mapFormDataToPayload = (formData) => {
  const port = Number(formData.port) || 587;
  const imapPort = Number(formData.imapPort) || 993;
  const smtpSecure = boolFromSecurityOption(formData.security);
  const imapSecure = boolFromSecurityOption(formData.imapSecurity);

  const payload = {
    name: formData.name,
    email: formData.fromEmail,
    fromEmail: formData.fromEmail,
    type: formData.type || 'both',
    host: formData.host,
    smtpHost: formData.host,
    port,
    smtpPort: port,
    security: formData.security,
    smtpSecure,
    smtpAuth: true,
    username: formData.username,
    smtpUsername: formData.username,
    isSystem: Boolean(formData.isSystem),
    allowUsers: Boolean(formData.allowUsers),
    imapHost: formData.imapHost,
    imapPort,
    imapSecurity: formData.imapSecurity,
    imapSecure,
    imapUsername: formData.imapUsername,
    imapFolder: formData.imapFolder
  };

  if (typeof formData.password === 'string' && formData.password.length > 0) {
    payload.password = formData.password;
    payload.smtpPassword = formData.password;
  }

  if (typeof formData.imapPassword === 'string' && formData.imapPassword.length > 0) {
    payload.imapPassword = formData.imapPassword;
  }

  return payload;
};

const Settings = () => {
  const [activeTab, setActiveTab] = useState('smtp');
  const [showAddSmtpModal, setShowAddSmtpModal] = useState(false);
  const [showEditSmtpModal, setShowEditSmtpModal] = useState(false);
  const [selectedSmtp, setSelectedSmtp] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10); // 10 items per page for list view
  const queryClient = useQueryClient();

  const { data: smtpAccounts, isLoading: smtpLoading } = useQuery('smtp-accounts', async () => {
    const response = await axios.get('/api/smtp-accounts');
    return response.data;
  });

  const addSmtpMutation = useMutation(async (smtpData) => {
    const response = await axios.post('/api/smtp-accounts', smtpData);
    return response.data;
  }, {
    onSuccess: () => {
      queryClient.invalidateQueries('smtp-accounts');
      setShowAddSmtpModal(false);
      toast.success('SMTP account added successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to add SMTP account');
    }
  });

  const testSmtpMutation = useMutation(async (smtpId) => {
    const response = await axios.post(`/api/smtp-accounts/${smtpId}/test`);
    return response.data;
  }, {
    onSuccess: () => {
      toast.success('SMTP connection test successful');
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'SMTP connection test failed');
    }
  });

  const updateSmtpMutation = useMutation(async ({ id, data }) => {
    const response = await axios.put(`/api/smtp-accounts/${id}`, data);
    return response.data;
  }, {
    onSuccess: () => {
      queryClient.invalidateQueries('smtp-accounts');
      setShowEditSmtpModal(false);
      setSelectedSmtp(null);
      toast.success('SMTP account updated');
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to update SMTP account');
    }
  });

  const deleteSmtpMutation = useMutation(async (id) => {
    const response = await axios.delete(`/api/smtp-accounts/${id}`);
    return response.data;
  }, {
    onSuccess: () => {
      queryClient.invalidateQueries('smtp-accounts');
      toast.success('SMTP account deleted');
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to delete SMTP account');
    }
  });

  const setPriorityMutation = useMutation(async ({ id, priority }) => {
    const response = await axios.post(`/api/smtp-accounts/${id}/set-priority`, { priority });
    return response.data;
  }, {
    onSuccess: () => {
      queryClient.invalidateQueries('smtp-accounts');
      toast.success('SMTP priority updated');
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to update priority');
    }
  });

  const toggleActiveMutation = useMutation(async ({ id, isActive }) => {
    const response = await axios.put(`/api/smtp-accounts/${id}`, { isActive });
    return response.data;
  }, {
    onSuccess: () => {
      queryClient.invalidateQueries('smtp-accounts');
      toast.success('SMTP account updated');
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to update SMTP account');
    }
  });

  const tabs = [
    { id: 'smtp', name: 'SMTP Accounts', icon: Mail },
    { id: 'imap', name: 'IMAP Settings', icon: Inbox },
    { id: 'security', name: 'Security', icon: Shield }
  ];

  const handleEditSmtp = (smtp) => {
    setSelectedSmtp(smtp);
    setShowEditSmtpModal(true);
  };

  const handleTestSmtp = (smtpId) => {
    testSmtpMutation.mutate(smtpId);
  };

  const sortedSmtpAccounts = React.useMemo(() => {
    if (!Array.isArray(smtpAccounts)) return [];
    return [...smtpAccounts].sort((a, b) => {
      const priorityA = a.sendPriority ?? 1000;
      const priorityB = b.sendPriority ?? 1000;
      if (priorityA !== priorityB) return priorityA - priorityB;
      const createdAtA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const createdAtB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return createdAtA - createdAtB;
    });
  }, [smtpAccounts]);

  // Get currently active primary SMTP (the one being used)
  const activePrimarySmtp = React.useMemo(() => {
    return sortedSmtpAccounts.find(account => 
      account.isActive && account.sendPriority === 1
    );
  }, [sortedSmtpAccounts]);

  // Pagination logic
  const totalPages = Math.ceil(sortedSmtpAccounts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedAccounts = sortedSmtpAccounts.slice(startIndex, endIndex);

  const handleSetPrimary = (accountId) => {
    setPriorityMutation.mutate({ id: accountId, priority: 1 });
  };

  const handleMovePriority = (account, direction) => {
    const nextPriority = Math.max(1, (account.sendPriority || 1) + direction);
    setPriorityMutation.mutate({ id: account.id, priority: nextPriority });
  };

  const handleToggleActive = (account) => {
    toggleActiveMutation.mutate({ id: account.id, isActive: !account.isActive });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600">Manage system configuration and user accounts</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="h-5 w-5 mr-2" />
                {tab.name}
              </button>
            );
          })}
        </nav>
      </div>

      {/* SMTP Accounts Tab */}
      {activeTab === 'smtp' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-medium text-gray-900">SMTP Accounts</h2>
              <p className="text-sm text-gray-600">Configure email sending accounts</p>
              {activePrimarySmtp && (
                <div className="mt-2 flex items-center space-x-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-gray-600">
                    Currently using: <span className="font-semibold text-gray-900">{activePrimarySmtp.name}</span> ({activePrimarySmtp.email})
                  </span>
                </div>
              )}
            </div>
            <button
              onClick={() => setShowAddSmtpModal(true)}
              className="btn-primary flex items-center"
            >
              <Plus className="h-5 w-5 mr-2" />
              Add SMTP Account
            </button>
          </div>

          {/* List View */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Host</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Active</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {smtpLoading ? (
                    <tr>
                      <td colSpan="8" className="px-6 py-8 text-center">
                        <div className="flex justify-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                        </div>
                      </td>
                    </tr>
                  ) : paginatedAccounts.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="px-6 py-8 text-center text-gray-500">
                        <Server className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p>No SMTP accounts configured</p>
                      </td>
                    </tr>
                  ) : (
                    paginatedAccounts.map((account) => {
                      const isCurrentlyActive = activePrimarySmtp?.id === account.id;
                      return (
                        <tr key={account.id} className={isCurrentlyActive ? 'bg-green-50' : 'hover:bg-gray-50'}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {isCurrentlyActive ? (
                              <div className="flex items-center space-x-1">
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                <span className="text-xs text-green-600 font-medium">Active</span>
                              </div>
                            ) : (
                              <span className={`px-2 py-1 text-xs rounded-full ${
                                account.sendPriority === 1 
                                  ? 'bg-blue-100 text-blue-800' 
                                  : account.sendPriority === 2
                                  ? 'bg-purple-100 text-purple-700'
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {account.sendPriority === 1 ? 'Primary' : account.sendPriority === 2 ? 'Secondary' : `Priority ${account.sendPriority}`}
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{account.name}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-600">{account.email || account.fromEmail}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-600">{account.smtpHost || account.host}:{account.smtpPort || account.port}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-600">{account.sendPriority ?? '—'}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-600">{account.type?.toUpperCase() || 'BOTH'}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <button
                              onClick={() => handleToggleActive(account)}
                              disabled={toggleActiveMutation.isLoading}
                              className={`px-2 py-1 text-xs rounded ${
                                account.isActive
                                  ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                              }`}
                            >
                              {account.isActive ? 'Active' : 'Paused'}
                            </button>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex items-center justify-end space-x-2">
                              <button
                                onClick={() => handleTestSmtp(account.id)}
                                className="text-gray-400 hover:text-gray-600"
                                title="Test Connection"
                              >
                                <TestTube className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleEditSmtp(account)}
                                className="text-gray-400 hover:text-gray-600"
                                title="Edit"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => deleteSmtpMutation.mutate(account.id)}
                                className="text-gray-400 hover:text-red-600"
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

          {/* Pagination */}
          {!smtpLoading && sortedSmtpAccounts.length > 0 && totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6 rounded-lg">
              <div className="flex flex-1 justify-between sm:hidden">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
              <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Showing <span className="font-medium">{startIndex + 1}</span> to{' '}
                    <span className="font-medium">{Math.min(endIndex, sortedSmtpAccounts.length)}</span> of{' '}
                    <span className="font-medium">{sortedSmtpAccounts.length}</span> accounts
                  </p>
                </div>
                <div>
                  <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                      if (
                        page === 1 ||
                        page === totalPages ||
                        (page >= currentPage - 1 && page <= currentPage + 1)
                      ) {
                        return (
                          <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${
                              currentPage === page
                                ? 'z-10 bg-primary-600 text-white focus:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600'
                                : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0'
                            }`}
                          >
                            {page}
                          </button>
                        );
                      } else if (page === currentPage - 2 || page === currentPage + 2) {
                        return <span key={page} className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-700">...</span>;
                      }
                      return null;
                    })}
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* IMAP Settings Tab */}
      {activeTab === 'imap' && (
        <ImapSettings />
      )}

      {/* Security Tab */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-medium text-gray-900">Security Settings</h2>
            <p className="text-sm text-gray-600">Configure security and compliance settings</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="card">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Email Security</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">SSL/TLS Encryption</p>
                    <p className="text-sm text-gray-600">Encrypt email connections</p>
                  </div>
                  <span className="status-badge bg-green-100 text-green-800">Enabled</span>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Password Encryption</p>
                    <p className="text-sm text-gray-600">Encrypt stored passwords</p>
                  </div>
                  <span className="status-badge bg-green-100 text-green-800">Enabled</span>
                </div>
              </div>
            </div>

            <div className="card">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Compliance</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Unsubscribe Links</p>
                    <p className="text-sm text-gray-600">Include unsubscribe in emails</p>
                  </div>
                  <span className="status-badge bg-green-100 text-green-800">Enabled</span>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Audit Logging</p>
                    <p className="text-sm text-gray-600">Log all admin actions</p>
                  </div>
                  <span className="status-badge bg-green-100 text-green-800">Enabled</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add SMTP Modal */}
      <Transition appear show={showAddSmtpModal} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowAddSmtpModal(false)}>
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
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                  <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900 mb-4">
                    Add SMTP Account
                  </Dialog.Title>
                  
                  <SmtpForm 
                    onSubmit={(data) => addSmtpMutation.mutate(data)}
                    onCancel={() => setShowAddSmtpModal(false)}
                    loading={addSmtpMutation.isLoading}
                  />
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Edit SMTP Modal */}
      <Transition appear show={showEditSmtpModal} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowEditSmtpModal(false)}>
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
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                  <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900 mb-4">
                    Edit SMTP Account
                  </Dialog.Title>
                  
                  <SmtpForm
                    initialData={selectedSmtp}
                    onSubmit={(data) => updateSmtpMutation.mutate({ id: selectedSmtp.id, data })}
                    onCancel={() => setShowEditSmtpModal(false)}
                    loading={updateSmtpMutation.isLoading}
                  />
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
};

  const SmtpForm = ({ onSubmit, onCancel, loading, initialData }) => {
  const [formData, setFormData] = useState(mapAccountToFormData());
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);
  const [showImapPassword, setShowImapPassword] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData(mapAccountToFormData(initialData));
    } else {
      setFormData(mapAccountToFormData());
    }
    setShowSmtpPassword(false);
    setShowImapPassword(false);
  }, [initialData]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(mapFormDataToPayload(formData));
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Account Name
        </label>
        <input
          type="text"
          name="name"
          required
          value={formData.name}
          onChange={handleChange}
          className="input-field"
          placeholder="e.g., Gmail SMTP"
        />
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Host
          </label>
          <input
            type="text"
            name="host"
            required
            value={formData.host}
            onChange={handleChange}
            className="input-field"
            placeholder="smtp.gmail.com"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Port
          </label>
          <input
            type="number"
            name="port"
            required
            value={formData.port}
            onChange={handleChange}
            className="input-field"
          />
        </div>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Security
        </label>
        <select
          name="security"
          value={formData.security}
          onChange={handleChange}
          className="input-field"
        >
          <option value="none">None</option>
          <option value="tls">TLS</option>
          <option value="ssl">SSL</option>
        </select>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Username
        </label>
        <input
          type="text"
          name="username"
          required
          value={formData.username}
          onChange={handleChange}
          className="input-field"
          placeholder="your-email@gmail.com"
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Password
        </label>
        <div className="relative">
          <input
            type={showSmtpPassword ? 'text' : 'password'}
            name="password"
            required={!initialData}
            value={formData.password ?? ''}
            onChange={handleChange}
            className="input-field pr-24"
            placeholder="App password or account password"
          />
          <button
            type="button"
            onClick={() => setShowSmtpPassword((prev) => !prev)}
            className="absolute inset-y-0 right-0 px-3 text-sm font-medium text-primary-600 hover:text-primary-800 focus:outline-none"
          >
            {showSmtpPassword ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          From Email
        </label>
        <input
          type="email"
          name="fromEmail"
          required
          value={formData.fromEmail}
          onChange={handleChange}
          className="input-field"
          placeholder="your-email@gmail.com"
        />
      </div>
      
      <div className="space-y-3">
        <div className="flex items-center">
          <input
            type="checkbox"
            name="isSystem"
            checked={Boolean(formData.isSystem)}
            onChange={handleChange}
            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
          />
          <label className="ml-2 block text-sm text-gray-900">
            System Account (can be used by all users)
          </label>
        </div>
        
        <div className="flex items-center">
          <input
            type="checkbox"
            name="allowUsers"
            checked={Boolean(formData.allowUsers)}
            onChange={handleChange}
            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
          />
          <label className="ml-2 block text-sm text-gray-900">
            Allow users to use this account
          </label>
        </div>
      </div>

      {/* IMAP Settings */}
      <div className="mt-6">
        <h4 className="text-md font-medium text-gray-900 mb-3">Inbound Email (IMAP)</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">IMAP Host</label>
            <input
              type="text"
              name="imapHost"
              value={formData.imapHost}
              onChange={handleChange}
              className="input-field"
              placeholder="imap.gmail.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">IMAP Port</label>
            <input
              type="number"
              name="imapPort"
              value={formData.imapPort}
              onChange={handleChange}
              className="input-field"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">IMAP Security</label>
            <select
              name="imapSecurity"
              value={formData.imapSecurity}
              onChange={handleChange}
              className="input-field"
            >
              <option value="none">None</option>
              <option value="tls">TLS</option>
              <option value="ssl">SSL</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">IMAP Folder</label>
            <input
              type="text"
              name="imapFolder"
              value={formData.imapFolder}
              onChange={handleChange}
              className="input-field"
              placeholder="INBOX"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">IMAP Username</label>
            <input
              type="text"
              name="imapUsername"
              value={formData.imapUsername}
              onChange={handleChange}
              className="input-field"
              placeholder="your-email@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">IMAP Password</label>
            <div className="relative">
              <input
                type={showImapPassword ? 'text' : 'password'}
                name="imapPassword"
                value={formData.imapPassword}
                onChange={handleChange}
                className="input-field pr-24"
                placeholder="App password or password"
              />
              <button
                type="button"
                onClick={() => setShowImapPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 px-3 text-sm font-medium text-primary-600 hover:text-primary-800 focus:outline-none"
              >
                {showImapPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex justify-end space-x-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="btn-secondary"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="btn-primary"
        >
          {loading ? (initialData ? 'Saving...' : 'Adding...') : (initialData ? 'Save Changes' : 'Add Account')}
        </button>
      </div>
    </form>
  );
};

export default Settings;
