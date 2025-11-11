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
  Inbox
} from 'lucide-react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import ImapSettings from './ImapSettings';

const Settings = () => {
  const [activeTab, setActiveTab] = useState('smtp');
  const [showAddSmtpModal, setShowAddSmtpModal] = useState(false);
  const [showEditSmtpModal, setShowEditSmtpModal] = useState(false);
  const [selectedSmtp, setSelectedSmtp] = useState(null);
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
            </div>
            <button
              onClick={() => setShowAddSmtpModal(true)}
              className="btn-primary flex items-center"
            >
              <Plus className="h-5 w-5 mr-2" />
              Add SMTP Account
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {smtpLoading ? (
              <div className="col-span-full flex justify-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
              </div>
            ) : sortedSmtpAccounts.length === 0 ? (
              <div className="col-span-full text-center py-8">
                <Server className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No SMTP accounts configured</p>
              </div>
            ) : (
              sortedSmtpAccounts.map((account, index) => (
                <div key={account.id} className="card">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 flex items-center space-x-2">
                        <span>{account.name}</span>
                        {account.sendPriority === 1 && (
                          <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-800">
                            Primary
                          </span>
                        )}
                        {account.sendPriority === 2 && (
                          <span className="px-2 py-0.5 text-xs rounded-full bg-purple-100 text-purple-700">
                            Secondary
                          </span>
                        )}
                      </h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Priority {account.sendPriority ?? '—'}
                      </p>
                    </div>
                    <div className="flex space-x-2">
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
                  </div>
                  
                  <div className="space-y-2 text-sm text-gray-600">
                    <div>
                      <span className="font-medium">Host:</span> {account.smtpHost || account.host}:{account.smtpPort || account.port}
                    </div>
                    <div>
                      <span className="font-medium">From:</span> {account.email || account.fromEmail}
                    </div>
                    <div>
                      <span className="font-medium">Type:</span> {account.type?.toUpperCase()}
                    </div>
                    <div>
                      <span className="font-medium">Security:</span> {account.smtpSecure ? 'SSL/TLS' : 'None'}
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="font-medium">System:</span>
                      <span className={`status-badge ${account.isSystem ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                        {account.isSystem ? 'Yes' : 'No'}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="font-medium">Allow Users:</span>
                      <span className={`status-badge ${account.allowUsers ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                        {account.allowUsers ? 'Yes' : 'No'}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="font-medium">Active for Sending:</span>
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
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {account.sendPriority !== 1 && (
                      <button
                        onClick={() => handleSetPrimary(account.id)}
                        disabled={setPriorityMutation.isLoading}
                        className="btn-secondary text-xs"
                      >
                        Set as Primary
                      </button>
                    )}
                    {account.sendPriority > 1 && (
                      <button
                        onClick={() => handleMovePriority(account, -1)}
                        disabled={setPriorityMutation.isLoading}
                        className="btn-secondary text-xs"
                      >
                        Move Up
                      </button>
                    )}
                    {account.sendPriority < sortedSmtpAccounts.length && (
                      <button
                        onClick={() => handleMovePriority(account, 1)}
                        disabled={setPriorityMutation.isLoading}
                        className="btn-secondary text-xs"
                      >
                        Move Down
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
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
  const [formData, setFormData] = useState({
    name: '',
    host: '',
    port: 587,
    security: 'tls',
    username: '',
    password: '',
    fromEmail: '',
    isSystem: false,
      allowUsers: true,
      // IMAP (inbound) settings
      imapHost: '',
      imapPort: 993,
      imapSecurity: 'ssl',
      imapUsername: '',
      imapPassword: '',
      imapFolder: 'INBOX'
  });

  useEffect(() => {
    if (initialData) {
      setFormData(prev => ({
        ...prev,
        ...initialData,
        password: '',
        imapPassword: ''
      }));
    }
  }, [initialData]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
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
        <input
          type="password"
          name="password"
          required
          value={formData.password}
          onChange={handleChange}
          className="input-field"
          placeholder="App password or account password"
        />
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
            checked={formData.isSystem}
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
            checked={formData.allowUsers}
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
            <input
              type="password"
              name="imapPassword"
              value={formData.imapPassword}
              onChange={handleChange}
              className="input-field"
              placeholder="App password or password"
            />
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
