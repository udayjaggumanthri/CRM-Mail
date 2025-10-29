import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import axios from 'axios';
import toast from 'react-hot-toast';
import useRealtimeEmail from '../hooks/useRealtimeEmail';
import { useAuth } from '../contexts/AuthContext';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
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
  Paperclip,
  ArrowLeft,
  Bold,
  Italic,
  Underline,
  List,
  Link,
  Image,
  Maximize2,
  Minimize2
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

  const [emailSuggestions, setEmailSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionInput, setSuggestionInput] = useState('');
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [isComposeMinimized, setIsComposeMinimized] = useState(false);
  const [showCC, setShowCC] = useState(false);
  const [showBCC, setShowBCC] = useState(false);
  const [attachmentFiles, setAttachmentFiles] = useState([]);

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

  const { data: emailAccounts = [], isLoading: emailAccountsLoading } = useQuery('email-accounts', async () => {
    const response = await axios.get('/api/email-accounts');
    return response.data;
  });

  // Fetch email suggestions for autocomplete
  const { data: suggestionsData, isLoading: suggestionsLoading } = useQuery(
    ['email-suggestions', suggestionInput],
    async () => {
      if (!suggestionInput || suggestionInput.length < 2) {
        return [];
      }
      try {
        const response = await axios.get(`/api/emails/suggestions?query=${encodeURIComponent(suggestionInput)}`);
        return response.data || [];
      } catch (error) {
        console.error('Error fetching email suggestions:', error);
        return [];
      }
    },
    {
      enabled: Boolean(suggestionInput && suggestionInput.length >= 2),
      staleTime: 30000, // Cache for 30 seconds
    }
  );

  React.useEffect(() => {
    if (suggestionsData) {
      setEmailSuggestions(suggestionsData);
      setShowSuggestions(suggestionsData.length > 0 && suggestionInput.length >= 2);
    } else {
      setEmailSuggestions([]);
      if (!suggestionInput || suggestionInput.length < 2) {
        setShowSuggestions(false);
      }
    }
  }, [suggestionsData, suggestionInput]);

  const queryClient = useQueryClient();

  // Mutation for marking email as starred (toggle)
  const starEmailMutation = useMutation(
    async (emailId) => {
      const currentEmail = emails.find(e => e.id === emailId);
      const newStarredState = !currentEmail?.isStarred;
      
      // Update via PUT endpoint
      const response = await axios.put(`/api/emails/${emailId}`, { 
        isStarred: newStarredState
      });
      return response.data;
    },
    {
      onSuccess: (data) => {
        queryClient.invalidateQueries(['emails', activeFolder]);
        if (selectedEmail) {
          // Update selected email in local state
          setSelectedEmail({ ...selectedEmail, isStarred: data.isStarred });
        }
        toast.success(data.isStarred ? 'Email starred' : 'Email unstarred');
      },
      onError: () => {
        toast.error('Failed to update email');
      }
    }
  );

  // Mutation for archiving email
  const archiveEmailMutation = useMutation(
    async (emailId) => {
      // Archive by updating folder directly via API
      const response = await axios.put(`/api/emails/${emailId}`, { 
        folder: 'archive'
      });
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['emails', activeFolder]);
        toast.success('Email archived');
        setSelectedEmail(null); // Close email view
      },
      onError: () => {
        toast.error('Failed to archive email');
      }
    }
  );

  // Mutation for deleting email
  const deleteEmailMutation = useMutation(
    async (emailId) => {
      const response = await axios.delete('/api/emails', { 
        data: { emailIds: [emailId] } 
      });
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['emails', activeFolder]);
        toast.success('Email moved to trash');
        setSelectedEmail(null); // Close email view
      },
      onError: () => {
        toast.error('Failed to delete email');
      }
    }
  );

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

  const handleToInputChange = (e) => {
    const value = e.target.value;
    setComposeData({ ...composeData, to: value });
    
    // Extract the last email address or current typing
    const parts = value.split(',').map(p => p.trim());
    const currentInput = parts[parts.length - 1];
    
    if (currentInput && currentInput.length >= 2) {
      setSuggestionInput(currentInput);
      setActiveSuggestionIndex(-1);
    } else {
      setSuggestionInput('');
      setShowSuggestions(false);
    }
  };

  const handleSuggestionSelect = (suggestion) => {
    // Replace the last part with the selected email
    const parts = composeData.to.split(',').map(p => p.trim());
    parts.pop(); // Remove the current typing
    const newTo = [...parts, suggestion.email].join(', ').trim();
    setComposeData({ ...composeData, to: newTo });
    setShowSuggestions(false);
    setSuggestionInput('');
    setActiveSuggestionIndex(-1);
  };

  const handleToInputKeyDown = (e) => {
    if (showSuggestions && emailSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveSuggestionIndex(prev => 
          prev < emailSuggestions.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveSuggestionIndex(prev => prev > 0 ? prev - 1 : -1);
      } else if (e.key === 'Enter' && activeSuggestionIndex >= 0) {
        e.preventDefault();
        handleSuggestionSelect(emailSuggestions[activeSuggestionIndex]);
      } else if (e.key === 'Escape') {
        setShowSuggestions(false);
        setActiveSuggestionIndex(-1);
      }
    }
  };

  const handleToInputBlur = () => {
    // Delay hiding suggestions to allow click on suggestion
    setTimeout(() => {
      setShowSuggestions(false);
    }, 250);
  };

  const handleAttachmentChange = (e) => {
    const files = Array.from(e.target.files);
    setAttachmentFiles(prev => [...prev, ...files]);
    // Store file objects for later upload
    const fileObjects = files.map(file => ({
      filename: file.name,
      size: file.size,
      type: file.type,
      file: file // Keep file object for FormData
    }));
    setComposeData(prev => ({
      ...prev,
      attachments: [...prev.attachments, ...fileObjects]
    }));
  };

  const handleRemoveAttachment = (index) => {
    setAttachmentFiles(prev => prev.filter((_, i) => i !== index));
    setComposeData(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index)
    }));
  };

  const resetComposeData = () => {
    setComposeData({
      to: '',
      cc: '',
      bcc: '',
      subject: '',
      body: '',
      attachments: []
    });
    setEmailSuggestions([]);
    setShowSuggestions(false);
    setSuggestionInput('');
    setActiveSuggestionIndex(-1);
    setAttachmentFiles([]);
    setShowCC(false);
    setShowBCC(false);
    setIsComposeMinimized(false);
  };

  const handleSync = async () => {
    setIsSyncing(true);
    syncEmailMutation.mutate();
  };

  const handleSendEmail = async () => {
    // Validate required fields
    if (!composeData.to || !composeData.to.trim()) {
      toast.error('Please enter a recipient email address');
      return;
    }
    
    if (!composeData.subject || !composeData.subject.trim()) {
      toast.error('Please enter a subject');
      return;
    }
    
    // Check if emailAccounts is loading
    if (emailAccountsLoading) {
      toast.error('Loading email accounts, please wait...');
      return;
    }
    
    // Check if emailAccounts is loaded
    if (!emailAccounts || (Array.isArray(emailAccounts) && emailAccounts.length === 0)) {
      toast.error('No email account configured. Please add an email account first.');
      return;
    }
    
    // Handle different response structures - emailAccounts should be an array directly
    let accountsArray = Array.isArray(emailAccounts) ? emailAccounts : [];
    
    if (accountsArray.length === 0) {
      toast.error('No email account configured. Please add an email account first.');
      return;
    }
    
    const defaultAccount = accountsArray[0];
    
    // Ensure we have a valid account ID
    const accountId = defaultAccount?.id || defaultAccount?.emailAccountId;
    if (!accountId) {
      console.error('Email account structure:', defaultAccount);
      console.error('Available email accounts:', accountsArray);
      toast.error('Invalid email account configuration. Please check your email account settings.');
      return;
    }
    
    try {
      // Prepare trimmed values
      const toEmail = composeData.to.trim();
      const subjectText = composeData.subject.trim();
      const ccEmail = (composeData.cc || '').trim();
      const bccEmail = (composeData.bcc || '').trim();
      
      // Ensure bodyHtml has content (ReactQuill might return empty string or just <p><br></p>)
      let bodyHtml = composeData.body || '';
      if (bodyHtml && bodyHtml.trim() && bodyHtml.trim() !== '<p><br></p>' && bodyHtml.trim() !== '<p></p>') {
        bodyHtml = bodyHtml.trim();
      } else {
        bodyHtml = '<p></p>';
      }
      
      const bodyText = bodyHtml.replace(/<[^>]*>/g, '').trim() || ' ';
      
      // Create FormData for file uploads
      const formData = new FormData();
      formData.append('emailAccountId', String(accountId));
      formData.append('to', toEmail);
      formData.append('cc', ccEmail);
      formData.append('bcc', bccEmail);
      formData.append('subject', subjectText);
      formData.append('bodyHtml', bodyHtml);
      formData.append('bodyText', bodyText);
      
      // Append attachments
      attachmentFiles.forEach((file) => {
        formData.append('attachments', file);
      });
      
      // Log what we're sending for debugging - expand the object
      console.log('=== Frontend: Sending Email ===');
      console.log('Email Account ID:', accountId, typeof accountId);
      console.log('To:', toEmail);
      console.log('Subject:', subjectText);
      console.log('CC:', ccEmail);
      console.log('BCC:', bccEmail);
      console.log('Body HTML length:', bodyHtml.length);
      console.log('Body Text length:', bodyText.length);
      console.log('Attachments count:', attachmentFiles.length);
      console.log('FormData keys:', Array.from(formData.keys()));
      
      // Log FormData entries with detailed info
      for (let pair of formData.entries()) {
        const value = pair[1];
        // Check if it's a File object using a safer method
        const isFile = value && typeof value === 'object' && value.constructor && value.constructor.name === 'File';
        if (isFile) {
          console.log(`FormData[${pair[0]}]:`, `[File: ${value.name}, size: ${value.size} bytes]`);
        } else {
          const valuePreview = typeof value === 'string' && value.length > 100 
            ? value.substring(0, 100) + '...' 
            : value;
          console.log(`FormData[${pair[0]}]:`, valuePreview, `(type: ${typeof value}, length: ${value?.length || 'N/A'})`);
        }
      }
      console.log('==============================');
      
      // Don't set Content-Type header - let axios set it automatically with boundary
      const response = await axios.post('/api/emails/send', formData);
      
      toast.success('Email sent successfully');
      setShowCompose(false);
      resetComposeData();
      refetch();
    } catch (error) {
      console.error('Send email error:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      console.error('Full error:', JSON.stringify(error.response?.data, null, 2));
      const errorMessage = error.response?.data?.error || error.response?.data?.details || error.message || 'Failed to send email';
      toast.error(errorMessage);
    }
  };

  // Quill editor modules configuration
  const quillModules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'align': [] }],
      ['link', 'image'],
      ['clean']
    ],
  };

  const quillFormats = [
    'header', 'bold', 'italic', 'underline', 'strike',
    'color', 'background', 'list', 'bullet', 'align',
    'link', 'image'
  ];

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

  // Helper function to check if email has attachments
  const hasAttachments = (email) => {
    if (email.hasAttachments === true) return true;
    if (!email.attachments) return false;
    
    // Handle array
    if (Array.isArray(email.attachments)) {
      return email.attachments.length > 0;
    }
    
    // Handle string (JSON stringified)
    if (typeof email.attachments === 'string') {
      const trimmed = email.attachments.trim();
      if (trimmed === '' || trimmed === '[]' || trimmed === 'null') return false;
      try {
        const parsed = JSON.parse(trimmed);
        return Array.isArray(parsed) ? parsed.length > 0 : !!parsed;
      } catch {
        return trimmed.length > 0;
      }
    }
    
    // Handle object
    return !!email.attachments;
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

  const handleReply = () => {
    if (!selectedEmail) return;
    setComposeData({
      to: selectedEmail.from || '',
      cc: '',
      bcc: '',
      subject: selectedEmail.subject?.startsWith('Re:') ? selectedEmail.subject : `Re: ${selectedEmail.subject || ''}`,
      body: `\n\n--- Original Message ---\nFrom: ${selectedEmail.from}\nTo: ${selectedEmail.to}\nDate: ${selectedEmail.date ? new Date(selectedEmail.date).toLocaleString() : ''}\nSubject: ${selectedEmail.subject || ''}\n\n${selectedEmail.bodyText || selectedEmail.body || ''}`,
      attachments: []
    });
    setShowCompose(true);
  };

  const handleForward = () => {
    if (!selectedEmail) return;
    setComposeData({
      to: '',
      cc: '',
      bcc: '',
      subject: selectedEmail.subject?.startsWith('Fwd:') ? selectedEmail.subject : `Fwd: ${selectedEmail.subject || ''}`,
      body: `\n\n--- Forwarded Message ---\nFrom: ${selectedEmail.from}\nTo: ${selectedEmail.to}\nDate: ${selectedEmail.date ? new Date(selectedEmail.date).toLocaleString() : ''}\nSubject: ${selectedEmail.subject || ''}\n\n${selectedEmail.bodyText || selectedEmail.body || ''}`,
      attachments: []
    });
    setShowCompose(true);
  };

  const handleStar = () => {
    if (!selectedEmail) return;
    starEmailMutation.mutate(selectedEmail.id);
  };

  const handleArchive = () => {
    if (!selectedEmail) return;
    if (window.confirm('Archive this email?')) {
      archiveEmailMutation.mutate(selectedEmail.id);
    }
  };

  const handleDelete = () => {
    if (!selectedEmail) return;
    if (window.confirm('Move this email to trash?')) {
      deleteEmailMutation.mutate(selectedEmail.id);
    }
  };

  const handleFolderChange = (folderId) => {
    setActiveFolder(folderId);
    setCurrentPage(1);
    setSelectedEmail(null); // Clear selected email to show folder list
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
          {!selectedEmail ? (
            // Email List View - Full Width
            <div className="flex-1 border-r border-gray-200 bg-white flex flex-col overflow-hidden">
            
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
                      {getInitials(activeFolder === 'sent' ? (email.to || '') : (email.from || ''))}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-sm truncate ${!email.isRead ? 'font-semibold text-gray-900' : 'font-normal text-gray-700'}`}>
                          {activeFolder === 'sent' 
                            ? (email.to?.split('<')[0].trim() || email.to || 'No recipient')
                            : (email.from?.split('<')[0].trim() || email.from || 'Unknown sender')}
                        </span>
                        <span className="text-xs text-gray-500 flex-none ml-2">
                          {formatDate(email.date)}
                        </span>
                      </div>
                      
                    <div className={`text-sm mb-1 truncate ${!email.isRead ? 'font-medium text-gray-900' : 'text-gray-700'}`}>
                      <div className="flex items-center space-x-2">
                        <span>{email.subject || '(no subject)'}</span>
                        {hasAttachments(email) && (
                          <Paperclip className="h-3.5 w-3.5 text-gray-500 flex-none" title="Has attachments" />
                        )}
                      </div>
                    </div>
                      
                    <div className="text-xs text-gray-500 truncate">
                      {email.bodyText?.substring(0, 100) || 'No preview available'}
                    </div>
                  </div>
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
          ) : (
            // Email Detail View - Full Page
            <div className="flex-1 bg-white overflow-y-auto">
              <div className="border-b border-gray-200 p-6">
                <div className="flex items-center space-x-4 mb-4">
                  <button
                    onClick={() => setSelectedEmail(null)}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    title="Back to inbox"
                  >
                    <ArrowLeft className="h-5 w-5 text-gray-600" />
                  </button>
                  <h2 className="text-2xl font-normal text-gray-900 flex-1">
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
                  <button 
                    onClick={handleReply}
                    className="flex items-center space-x-1 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                  >
                    <Reply className="h-4 w-4" />
                    <span>Reply</span>
                  </button>
                  <button 
                    onClick={handleForward}
                    className="flex items-center space-x-1 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                  >
                    <Forward className="h-4 w-4" />
                    <span>Forward</span>
                  </button>
                  <button 
                    onClick={handleStar}
                    className={`flex items-center space-x-1 px-3 py-1.5 text-sm rounded-md transition-colors ${
                      selectedEmail?.isStarred 
                        ? 'text-yellow-600 bg-yellow-50 hover:bg-yellow-100' 
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Star className={`h-4 w-4 ${selectedEmail?.isStarred ? 'fill-current' : ''}`} />
                    <span>Star</span>
                  </button>
                  <button 
                    onClick={handleArchive}
                    className="flex items-center space-x-1 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                  >
                    <Archive className="h-4 w-4" />
                    <span>Archive</span>
                  </button>
                  <button 
                    onClick={handleDelete}
                    className="flex items-center space-x-1 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>Delete</span>
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

      {/* Gmail-style Compose Window */}
      {showCompose && (
        <div className={`fixed ${isComposeMinimized ? 'bottom-4 right-4 w-96 h-auto' : 'bottom-4 right-4 w-[600px] h-[600px]'} z-50 bg-white shadow-2xl rounded-lg border border-gray-300 flex flex-col transition-all duration-300`}>
          {/* Header */}
          <div className="bg-gray-50 px-4 py-3 flex items-center justify-between border-b border-gray-200 rounded-t-lg">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-700">New Message</span>
            </div>
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setIsComposeMinimized(!isComposeMinimized)}
                className="p-1.5 hover:bg-gray-200 rounded transition-colors"
                title={isComposeMinimized ? 'Maximize' : 'Minimize'}
              >
                {isComposeMinimized ? <Maximize2 className="h-4 w-4 text-gray-600" /> : <Minimize2 className="h-4 w-4 text-gray-600" />}
              </button>
              <button
                onClick={() => {
                  setShowCompose(false);
                  resetComposeData();
                }}
                className="p-1.5 hover:bg-gray-200 rounded transition-colors"
                title="Close"
              >
                <X className="h-4 w-4 text-gray-600" />
              </button>
            </div>
          </div>

          {!isComposeMinimized && (
            <>
              {/* To, CC, BCC Fields */}
              <div className="px-4 py-2 border-b border-gray-200 space-y-2">
                <div className="relative">
                  <div className="flex items-center">
                    <span className="text-xs text-gray-500 w-12 flex-shrink-0">To</span>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        placeholder="Recipients"
                        value={composeData.to}
                        onChange={handleToInputChange}
                        onKeyDown={handleToInputKeyDown}
                        onFocus={() => {
                          if (suggestionInput && suggestionInput.length >= 2) {
                            setShowSuggestions(emailSuggestions.length > 0);
                          }
                        }}
                        onBlur={handleToInputBlur}
                        className="w-full px-2 py-1 text-sm border-0 focus:ring-0 placeholder-gray-400"
                        autoComplete="off"
                      />
                      {showSuggestions && emailSuggestions.length > 0 && (
                        <div className="absolute z-[60] top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                          {suggestionsLoading && (
                            <div className="px-4 py-2 text-sm text-gray-500">
                              Loading suggestions...
                            </div>
                          )}
                          {!suggestionsLoading && emailSuggestions.map((suggestion, index) => (
                            <div
                              key={index}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                handleSuggestionSelect(suggestion);
                              }}
                              className={`px-4 py-2 cursor-pointer hover:bg-gray-100 transition-colors ${
                                index === activeSuggestionIndex ? 'bg-blue-50' : ''
                              }`}
                            >
                              <div className="flex items-center space-x-2">
                                <Mail className="h-4 w-4 text-gray-400 flex-none" />
                                <div className="flex-1 min-w-0">
                                  {suggestion.name ? (
                                    <>
                                      <div className="text-sm font-medium text-gray-900 truncate">
                                        {suggestion.name}
                                      </div>
                                      <div className="text-xs text-gray-500 truncate">
                                        {suggestion.email}
                                      </div>
                                    </>
                                  ) : (
                                    <div className="text-sm text-gray-900 truncate">
                                      {suggestion.email}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {showCC && (
                  <div className="flex items-center">
                    <span className="text-xs text-gray-500 w-12 flex-shrink-0">Cc</span>
                    <input
                      type="text"
                      placeholder="Cc"
                      value={composeData.cc}
                      onChange={(e) => setComposeData({ ...composeData, cc: e.target.value })}
                      className="flex-1 px-2 py-1 text-sm border-0 focus:ring-0 placeholder-gray-400"
                      autoComplete="off"
                    />
                  </div>
                )}

                {showBCC && (
                  <div className="flex items-center">
                    <span className="text-xs text-gray-500 w-12 flex-shrink-0">Bcc</span>
                    <input
                      type="text"
                      placeholder="Bcc"
                      value={composeData.bcc}
                      onChange={(e) => setComposeData({ ...composeData, bcc: e.target.value })}
                      className="flex-1 px-2 py-1 text-sm border-0 focus:ring-0 placeholder-gray-400"
                      autoComplete="off"
                    />
                  </div>
                )}

                {/* CC/BCC Toggle */}
                <div className="flex items-center space-x-4 pl-12">
                  <button
                    onClick={() => setShowCC(!showCC)}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    {showCC ? 'Remove Cc' : 'Cc'}
                  </button>
                  <button
                    onClick={() => setShowBCC(!showBCC)}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    {showBCC ? 'Remove Bcc' : 'Bcc'}
                  </button>
                </div>

                {/* Subject */}
                <div className="flex items-center pt-2 border-t border-gray-100">
                  <input
                    type="text"
                    placeholder="Subject"
                    value={composeData.subject}
                    onChange={(e) => setComposeData({ ...composeData, subject: e.target.value })}
                    className="flex-1 px-2 py-1 text-sm border-0 focus:ring-0 placeholder-gray-400"
                  />
                </div>
              </div>

              {/* Rich Text Editor */}
              <div className="flex-1" style={{ minHeight: '300px', maxHeight: '500px', display: 'flex', flexDirection: 'column' }}>
                <ReactQuill
                  theme="snow"
                  value={composeData.body}
                  onChange={(value) => setComposeData({ ...composeData, body: value })}
                  modules={quillModules}
                  formats={quillFormats}
                  placeholder="Compose your message..."
                  style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
                />
                <style>{`
                  .ql-container {
                    flex: 1;
                    overflow-y: auto;
                    font-size: 14px;
                  }
                  .ql-editor {
                    min-height: 250px;
                  }
                  .ql-toolbar {
                    border-top: 1px solid #e5e7eb;
                    border-left: none;
                    border-right: none;
                    padding: 8px;
                  }
                `}</style>
              </div>

              {/* Attachments */}
              {attachmentFiles.length > 0 && (
                <div className="px-4 py-2 border-t border-gray-200">
                  <div className="flex flex-wrap gap-2">
                    {attachmentFiles.map((file, index) => (
                      <div key={index} className="flex items-center space-x-2 px-2 py-1 bg-gray-100 rounded text-sm">
                        <Paperclip className="h-3 w-3 text-gray-600" />
                        <span className="text-xs text-gray-700">{file.name}</span>
                        <button
                          onClick={() => handleRemoveAttachment(index)}
                          className="ml-1 hover:text-red-600"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      multiple
                      onChange={handleAttachmentChange}
                      className="hidden"
                    />
                    <Paperclip className="h-5 w-5 text-gray-600 hover:text-gray-800 cursor-pointer" />
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      setShowCompose(false);
                      resetComposeData();
                    }}
                    className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded transition-colors"
                  >
                    Discard
                  </button>
                  <button
                    onClick={handleSendEmail}
                    className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Send className="h-4 w-4" />
                    <span>Send</span>
                  </button>
                </div>
              </div>
            </>
          )}

          {isComposeMinimized && (
            <div className="px-4 py-2">
              <div className="text-sm text-gray-600 truncate">
                {composeData.to || 'New Message'}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default UnifiedEmail;
