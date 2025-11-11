import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import axios from 'axios';
import toast from 'react-hot-toast';
import useRealtimeEmail from '../hooks/useRealtimeEmail';
import { useAuth } from '../contexts/AuthContext';
import ReactQuill, { Quill } from 'react-quill';
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

// Register custom font whitelist for Quill so selected fonts actually apply
const Font = Quill.import('formats/font');
Font.whitelist = [
  'arial',
  'timesnewroman',
  'helvetica',
  'georgia',
  'verdana',
  'trebuchetms',
  'tahoma',
  'couriernew',
  'lucidasansunicode',
  'palatinolinotype'
];
Quill.register(Font, true);

const UnifiedEmail = () => {
  const { user } = useAuth();
  const [activeFolder, setActiveFolder] = useState('inbox');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [showCompose, setShowCompose] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [activeEmailAccountId, setActiveEmailAccountId] = useState('all');
  const [selectedEmailAccountId, setSelectedEmailAccountId] = useState(null);
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
  const [editingDraftId, setEditingDraftId] = useState(null); // Track which draft is being edited

  const [emailSuggestions, setEmailSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionInput, setSuggestionInput] = useState('');
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [isComposeMinimized, setIsComposeMinimized] = useState(false);
  const [showCC, setShowCC] = useState(false);
  const [showBCC, setShowBCC] = useState(false);
  const [attachmentFiles, setAttachmentFiles] = useState([]);
  const [showDraftConfirm, setShowDraftConfirm] = useState(false);
  const [pendingCloseAction, setPendingCloseAction] = useState(null); // 'close' or 'discard'

  const { data: emailsData, isLoading, refetch } = useQuery(
    ['emails', activeFolder, searchTerm, currentPage, filters, activeEmailAccountId], 
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
      if (activeEmailAccountId && activeEmailAccountId !== 'all') {
        params.append('accountId', activeEmailAccountId);
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

  const sortedEmailAccounts = React.useMemo(() => {
    const accountsArray = Array.isArray(emailAccounts) ? emailAccounts : [];
    return [...accountsArray].sort((a, b) => {
      const priorityA = a.sendPriority ?? 1000;
      const priorityB = b.sendPriority ?? 1000;
      if (priorityA !== priorityB) return priorityA - priorityB;
      const createdAtA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const createdAtB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return createdAtA - createdAtB;
    });
  }, [emailAccounts]);

  React.useEffect(() => {
    if (!sortedEmailAccounts.length) {
      setSelectedEmailAccountId(null);
      return;
    }
    setSelectedEmailAccountId((prev) => {
      if (prev && sortedEmailAccounts.some(acc => acc.id === prev)) {
        return prev;
      }
      return sortedEmailAccounts[0].id;
    });
    setActiveEmailAccountId((prev) => {
      if (prev === 'all') return prev;
      if (sortedEmailAccounts.some(acc => acc.id === prev)) {
        return prev;
      }
      return sortedEmailAccounts[0].id;
    });
  }, [sortedEmailAccounts]);

  React.useEffect(() => {
    if (showCompose) return;
    if (activeEmailAccountId !== 'all' && sortedEmailAccounts.some(acc => acc.id === activeEmailAccountId)) {
      setSelectedEmailAccountId(activeEmailAccountId);
    }
  }, [activeEmailAccountId, showCompose, sortedEmailAccounts]);

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

  // Permanent delete mutation for drafts
  const deleteDraftMutation = useMutation(
    async (emailId) => {
      const response = await axios.delete('/api/emails/permanent', { 
        data: { emailIds: [emailId] } 
      });
      return response.data;
    },
    {
      onSuccess: (data, emailId) => {
        queryClient.invalidateQueries(['emails', activeFolder]);
        toast.success('Draft deleted permanently');
        setSelectedEmail(null); // Close email view
        // If we were editing this draft, close compose modal
        if (editingDraftId === emailId) {
          setShowCompose(false);
          resetComposeData();
        }
      },
      onError: () => {
        toast.error('Failed to delete draft');
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

  const saveDraftMutation = useMutation(
    async () => {
      // Get email account (same logic as handleSendEmail)
      if (emailAccountsLoading || !emailAccounts || (Array.isArray(emailAccounts) && emailAccounts.length === 0)) {
        throw new Error('No email account configured');
      }

      const accountsArray = sortedEmailAccounts;
      if (accountsArray.length === 0) {
        throw new Error('No email account configured');
      }

      const preferredAccount = accountsArray.find(acc => acc.id === selectedEmailAccountId) || accountsArray[0];
      const accountId = preferredAccount?.id || preferredAccount?.emailAccountId;

      if (!accountId) {
        throw new Error('Invalid email account configuration');
      }

      if (preferredAccount && preferredAccount.isActive === false) {
        throw new Error('Selected SMTP account is paused. Please activate it or choose another.');
      }

      // Prepare FormData
      const formData = new FormData();
      formData.append('emailAccountId', String(accountId));
      formData.append('to', (composeData.to || '').trim());
      formData.append('cc', (composeData.cc || '').trim());
      formData.append('bcc', (composeData.bcc || '').trim());
      formData.append('subject', (composeData.subject || '').trim());

      let bodyHtml = composeData.body || '';
      if (!bodyHtml || bodyHtml.trim() === '<p><br></p>' || bodyHtml.trim() === '<p></p>') {
        bodyHtml = '';
      }
      formData.append('bodyHtml', bodyHtml);
      formData.append('bodyText', bodyHtml.replace(/<[^>]*>/g, '').trim() || '');

      // Append attachments
      attachmentFiles.forEach((file) => {
        formData.append('attachments', file);
      });

      // If editing existing draft, update it instead of creating new one
      if (editingDraftId) {
        // Update existing draft
        formData.append('draftId', editingDraftId);
        const response = await axios.put(`/api/emails/draft/${editingDraftId}`, formData);
        return response.data;
      } else {
        // Create new draft
        const response = await axios.post('/api/emails/draft', formData);
        return response.data;
      }
    },
    {
      onSuccess: () => {
        toast.success(editingDraftId ? 'Draft updated successfully' : 'Draft saved successfully');
        setShowCompose(false);
        resetComposeData();
        setShowDraftConfirm(false);
        setPendingCloseAction(null);
        refetch();
      },
      onError: (error) => {
        const errorMessage = error.response?.data?.error || error.message || 'Failed to save draft';
        toast.error(errorMessage);
      }
    }
  );

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

  const hasComposeContent = () => {
    const hasTo = composeData.to && composeData.to.trim().length > 0;
    const hasSubject = composeData.subject && composeData.subject.trim().length > 0;
    const hasBody = composeData.body && 
      composeData.body.trim().length > 0 && 
      composeData.body.trim() !== '<p><br></p>' && 
      composeData.body.trim() !== '<p></p>';
    const hasAttachments = attachmentFiles && attachmentFiles.length > 0;
    return hasTo || hasSubject || hasBody || hasAttachments;
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
    setEditingDraftId(null); // Clear draft editing state
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
    
    let accountsArray = sortedEmailAccounts;

    if (accountsArray.length === 0) {
      toast.error('No email account configured. Please add an email account first.');
      return;
    }
    
    const preferredAccount = accountsArray.find(acc => acc.id === selectedEmailAccountId) || accountsArray[0];
    const accountId = preferredAccount?.id || preferredAccount?.emailAccountId;
    if (!accountId) {
      console.error('Email account structure:', preferredAccount);
      console.error('Available email accounts:', accountsArray);
      toast.error('Invalid email account configuration. Please check your email account settings.');
      return;
    }

    if (preferredAccount && preferredAccount.isActive === false) {
      toast.error('Selected SMTP account is paused. Please activate it or choose another account.');
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
      
      // If we were editing a draft, delete it after successful send
      if (editingDraftId) {
        try {
          await axios.delete(`/api/emails/${editingDraftId}`);
          console.log('Draft deleted after sending');
        } catch (deleteError) {
          console.error('Failed to delete draft after sending:', deleteError);
          // Don't show error to user - email was sent successfully
        }
      }
      
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

  const handleCloseCompose = (closeType) => {
    if (hasComposeContent()) {
      setPendingCloseAction(closeType);
      setShowDraftConfirm(true);
    } else {
      // No content, close immediately
      setShowCompose(false);
      resetComposeData();
    }
  };

  const handleConfirmDiscard = () => {
    setShowCompose(false);
    resetComposeData();
    setShowDraftConfirm(false);
    setPendingCloseAction(null);
  };

  const handleConfirmSaveDraft = () => {
    saveDraftMutation.mutate();
  };

  const handleCancelDraftConfirm = () => {
    setShowDraftConfirm(false);
    setPendingCloseAction(null);
  };

  // Quill editor modules configuration
  const quillModules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      [{ 'font': ['arial', 'timesnewroman', 'helvetica', 'georgia', 'verdana', 'trebuchetms', 'tahoma', 'couriernew', 'lucidasansunicode', 'palatinolinotype'] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'align': [] }],
      ['link', 'image'],
      ['clean']
    ],
  };

  const quillFormats = [
    'header', 'font', 'bold', 'italic', 'underline', 'strike',
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

  const openComposeWindow = (preferredAccountId = null) => {
    if (preferredAccountId && preferredAccountId !== 'all' && sortedEmailAccounts.some(acc => acc.id === preferredAccountId)) {
      setSelectedEmailAccountId(preferredAccountId);
    } else if (!selectedEmailAccountId && sortedEmailAccounts.length) {
      setSelectedEmailAccountId(sortedEmailAccounts[0].id);
    }
    setShowCompose(true);
    setIsComposeMinimized(false);
  };

  const startNewCompose = () => {
    resetComposeData();
    const preferredAccount = activeEmailAccountId !== 'all' ? activeEmailAccountId : null;
    openComposeWindow(preferredAccount);
    setSelectedEmail(null);
  };

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
    openComposeWindow(selectedEmail.emailAccountId || activeEmailAccountId);
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
    openComposeWindow(selectedEmail.emailAccountId || activeEmailAccountId);
  };

  const handleEditDraft = (draftEmail) => {
    if (!draftEmail) return;
    
    // Parse attachments if they exist
    let draftAttachments = [];
    if (draftEmail.attachments) {
      try {
        if (Array.isArray(draftEmail.attachments)) {
          draftAttachments = draftEmail.attachments;
        } else if (typeof draftEmail.attachments === 'string') {
          draftAttachments = JSON.parse(draftEmail.attachments);
        }
      } catch (e) {
        console.error('Error parsing draft attachments:', e);
        draftAttachments = [];
      }
    }

    // Pre-populate compose data with draft content
    setComposeData({
      to: draftEmail.to || '',
      cc: draftEmail.cc || '',
      bcc: draftEmail.bcc || '',
      subject: draftEmail.subject || '',
      body: draftEmail.bodyHtml || draftEmail.body || '',
      attachments: []
    });
    
    // Note: We can't restore File objects from saved attachments (they're base64 in DB)
    // So we only restore the metadata. Users would need to re-attach files if needed.
    // For now, we'll just set the attachmentFiles to empty array
    setAttachmentFiles([]);
    
    // Track which draft we're editing
    setEditingDraftId(draftEmail.id);
    
    // Open compose modal
    openComposeWindow(draftEmail.emailAccountId || activeEmailAccountId);
    setSelectedEmail(null); // Close email view
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

  const handleDeleteDraft = (draftId) => {
    if (!draftId) {
      draftId = selectedEmail?.id || editingDraftId;
    }
    if (!draftId) return;
    
    if (window.confirm('Are you sure you want to permanently delete this draft? This action cannot be undone.')) {
      deleteDraftMutation.mutate(draftId);
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
              onClick={startNewCompose}
              className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors shadow-md"
            >
              <Pencil className="h-5 w-5" />
              <span className="font-medium">Compose</span>
            </button>
          </div>

          <div className="px-4 pb-4">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              SMTP Accounts
            </h4>
            <div className="space-y-1">
              <button
                onClick={() => setActiveEmailAccountId('all')}
                className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${
                  activeEmailAccountId === 'all'
                    ? 'bg-blue-100 text-blue-800 font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                All Accounts
              </button>
              {sortedEmailAccounts.map((account) => {
                const isSelected = activeEmailAccountId === account.id;
                const badge =
                  account.sendPriority === 1
                    ? 'Primary'
                    : account.sendPriority === 2
                      ? 'Secondary'
                      : `#${account.sendPriority}`;
                return (
                  <button
                    key={account.id}
                    onClick={() => setActiveEmailAccountId(account.id)}
                    className={`w-full px-3 py-2 text-sm rounded-md transition-colors flex items-center justify-between ${
                      isSelected
                        ? 'bg-blue-100 text-blue-800 font-medium'
                        : 'text-gray-700 hover:bg-gray-100'
                    } ${account.isActive ? '' : 'opacity-60'}`}
                  >
                    <span className="truncate">{account.name || account.email}</span>
                    <span className="ml-2 text-xs text-gray-500">{badge}</span>
                  </button>
                );
              })}
            </div>
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
                      // If it's a draft, open it in compose mode for editing
                      if (email.isDraft || email.status === 'draft') {
                        handleEditDraft(email);
                      } else {
                      console.log('Selected email:', email);
                      console.log('Email body:', email.body);
                      console.log('Email bodyText:', email.bodyText);
                      setSelectedEmail(email);
                      }
                    }}
                    className={`flex items-start space-x-3 px-4 py-3 cursor-pointer hover:shadow-sm transition-all group ${
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

                  {/* Quick delete button for drafts - appears on hover */}
                  {(email.isDraft || email.status === 'draft') && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent opening the draft
                        handleDeleteDraft(email.id);
                      }}
                      className="flex-none opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Delete draft permanently"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
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
                  {/* Show Edit button for drafts */}
                  {(selectedEmail?.isDraft || selectedEmail?.status === 'draft') ? (
                    <button 
                      onClick={() => handleEditDraft(selectedEmail)}
                      className="flex items-center space-x-1 px-3 py-1.5 text-sm text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
                    >
                      <Pencil className="h-4 w-4" />
                      <span>Edit Draft</span>
                    </button>
                  ) : (
                    <>
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
                    </>
                  )}
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
                  {/* Show Delete Draft for drafts, regular Delete for other emails */}
                  {(selectedEmail?.isDraft || selectedEmail?.status === 'draft') ? (
                    <button 
                      onClick={() => handleDeleteDraft(selectedEmail.id)}
                      disabled={deleteDraftMutation.isLoading}
                      className="flex items-center space-x-1 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>{deleteDraftMutation.isLoading ? 'Deleting...' : 'Delete Draft'}</span>
                    </button>
                  ) : (
                    <button 
                      onClick={handleDelete}
                      className="flex items-center space-x-1 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>Delete</span>
                    </button>
                  )}
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
              <span className="text-sm font-medium text-gray-700">
                {editingDraftId ? 'Edit Draft' : 'New Message'}
              </span>
              {editingDraftId && (
                <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
                  Draft
                </span>
              )}
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
                onClick={() => handleCloseCompose('close')}
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
              <div className="px-4 py-2 border-b border-gray-200 space-y-2 flex-shrink-0">
                <div className="flex items-center">
                  <span className="text-xs text-gray-500 w-12 flex-shrink-0">From</span>
                  {emailAccountsLoading ? (
                    <span className="text-xs text-gray-500 ml-2">Loading accounts...</span>
                  ) : !sortedEmailAccounts.length ? (
                    <span className="text-xs text-red-500 ml-2">No SMTP accounts</span>
                  ) : (
                    <select
                      value={selectedEmailAccountId || ''}
                      onChange={(e) => setSelectedEmailAccountId(e.target.value)}
                      className="flex-1 px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                    >
                      {sortedEmailAccounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name || account.email}{account.isActive === false ? ' (Paused)' : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
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
              <div className="flex-1 flex-shrink-0 overflow-hidden" style={{ minHeight: '300px', maxHeight: '500px', display: 'flex', flexDirection: 'column' }}>
                <ReactQuill
                  theme="snow"
                      value={composeData.body}
                  onChange={(value) => setComposeData({ ...composeData, body: value })}
                  modules={quillModules}
                  formats={quillFormats}
                  placeholder="Compose your message..."
                  style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
                  className="compose-editor"
                />
                <style>{`
                  .compose-editor .ql-container {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    overflow-y: auto;
                    font-size: 14px;
                    min-height: 0;
                  }
                  .compose-editor .ql-editor {
                    flex: 1;
                    min-height: 250px;
                    padding: 12px;
                    text-align: left;
                    line-height: 1.6;
                    word-wrap: break-word;
                    overflow-wrap: break-word;
                  }
                  .compose-editor .ql-editor.ql-blank::before {
                    left: 12px;
                    right: 12px;
                    text-align: left;
                    font-style: normal;
                    color: #9ca3af;
                  }
                  .compose-editor .ql-toolbar {
                    border-top: 1px solid #e5e7eb;
                    border-left: none;
                    border-right: none;
                    border-bottom: none;
                    padding: 8px;
                    flex-shrink: 0;
                  }
                  .compose-editor .ql-toolbar .ql-formats {
                    margin-right: 8px;
                  }
                  /* Keep font picker compact and avoid overflow */
                  .compose-editor .ql-toolbar .ql-picker.ql-font {
                    max-width: 160px;
                  }
                  .compose-editor .ql-toolbar .ql-picker.ql-font .ql-picker-label,
                  .compose-editor .ql-toolbar .ql-picker.ql-font .ql-picker-label::before,
                  .compose-editor .ql-toolbar .ql-picker.ql-font .ql-picker-label::after {
                    white-space: nowrap;
                  }
                  .compose-editor .ql-toolbar .ql-picker.ql-font .ql-picker-label {
                    overflow: hidden;
                    text-overflow: ellipsis;
                    display: inline-block;
                    max-width: 160px;
                    vertical-align: middle;
                  }
                  .compose-editor .ql-toolbar .ql-picker.ql-font .ql-picker-options {
                    min-width: 180px;
                  }
                  .compose-editor .ql-toolbar .ql-picker.ql-font .ql-picker-item,
                  .compose-editor .ql-toolbar .ql-picker.ql-font .ql-picker-item::before,
                  .compose-editor .ql-toolbar .ql-picker.ql-font .ql-picker-item::after {
                    white-space: nowrap;
                  }
                  
                  /* Font Family Styles - ReactQuill applies fonts via classes */
                  /* Critical: ReactQuill uses lowercase class names without spaces */
                  
                  /* Global font classes - ReactQuill requires these to work */
                  /* These must be global (not scoped) for ReactQuill to recognize them */
                  .ql-font-arial,
                  *[class*="ql-font-arial"] {
                    font-family: Arial, sans-serif !important;
                  }
                  .ql-font-timesnewroman,
                  *[class*="ql-font-timesnewroman"] {
                    font-family: 'Times New Roman', Times, serif !important;
                  }
                  .ql-font-helvetica,
                  *[class*="ql-font-helvetica"] {
                    font-family: Helvetica, Arial, sans-serif !important;
                  }
                  .ql-font-georgia,
                  *[class*="ql-font-georgia"] {
                    font-family: Georgia, serif !important;
                  }
                  .ql-font-verdana,
                  *[class*="ql-font-verdana"] {
                    font-family: Verdana, Geneva, sans-serif !important;
                  }
                  .ql-font-trebuchetms,
                  *[class*="ql-font-trebuchetms"] {
                    font-family: 'Trebuchet MS', Helvetica, sans-serif !important;
                  }
                  .ql-font-tahoma,
                  *[class*="ql-font-tahoma"] {
                    font-family: Tahoma, Geneva, sans-serif !important;
                  }
                  .ql-font-couriernew,
                  *[class*="ql-font-couriernew"] {
                    font-family: 'Courier New', Courier, monospace !important;
                  }
                  .ql-font-lucidasansunicode,
                  *[class*="ql-font-lucidasansunicode"] {
                    font-family: 'Lucida Sans Unicode', 'Lucida Grande', sans-serif !important;
                  }
                  .ql-font-palatinolinotype,
                  *[class*="ql-font-palatinolinotype"] {
                    font-family: 'Palatino Linotype', 'Book Antiqua', Palatino, serif !important;
                  }
                  
                  /* Apply fonts within compose editor - scoped rules with maximum specificity */
                  .compose-editor .ql-editor .ql-font-arial,
                  .compose-editor .ql-editor span.ql-font-arial,
                  .compose-editor .ql-editor p.ql-font-arial,
                  .compose-editor .ql-editor div.ql-font-arial,
                  .compose-editor .ql-editor strong.ql-font-arial,
                  .compose-editor .ql-editor em.ql-font-arial,
                  .compose-editor .ql-editor *[class*="ql-font-arial"] {
                    font-family: Arial, sans-serif !important;
                  }
                  
                  .compose-editor .ql-editor .ql-font-timesnewroman,
                  .compose-editor .ql-editor span.ql-font-timesnewroman,
                  .compose-editor .ql-editor p.ql-font-timesnewroman,
                  .compose-editor .ql-editor div.ql-font-timesnewroman,
                  .compose-editor .ql-editor strong.ql-font-timesnewroman,
                  .compose-editor .ql-editor em.ql-font-timesnewroman,
                  .compose-editor .ql-editor *[class*="ql-font-timesnewroman"] {
                    font-family: 'Times New Roman', Times, serif !important;
                  }
                  
                  .compose-editor .ql-editor .ql-font-helvetica,
                  .compose-editor .ql-editor span.ql-font-helvetica,
                  .compose-editor .ql-editor p.ql-font-helvetica,
                  .compose-editor .ql-editor div.ql-font-helvetica,
                  .compose-editor .ql-editor strong.ql-font-helvetica,
                  .compose-editor .ql-editor em.ql-font-helvetica,
                  .compose-editor .ql-editor *[class*="ql-font-helvetica"] {
                    font-family: Helvetica, Arial, sans-serif !important;
                  }
                  
                  .compose-editor .ql-editor .ql-font-georgia,
                  .compose-editor .ql-editor span.ql-font-georgia,
                  .compose-editor .ql-editor p.ql-font-georgia,
                  .compose-editor .ql-editor div.ql-font-georgia,
                  .compose-editor .ql-editor strong.ql-font-georgia,
                  .compose-editor .ql-editor em.ql-font-georgia,
                  .compose-editor .ql-editor *[class*="ql-font-georgia"] {
                    font-family: Georgia, serif !important;
                  }
                  
                  .compose-editor .ql-editor .ql-font-verdana,
                  .compose-editor .ql-editor span.ql-font-verdana,
                  .compose-editor .ql-editor p.ql-font-verdana,
                  .compose-editor .ql-editor div.ql-font-verdana,
                  .compose-editor .ql-editor strong.ql-font-verdana,
                  .compose-editor .ql-editor em.ql-font-verdana,
                  .compose-editor .ql-editor *[class*="ql-font-verdana"] {
                    font-family: Verdana, Geneva, sans-serif !important;
                  }
                  
                  .compose-editor .ql-editor .ql-font-trebuchetms,
                  .compose-editor .ql-editor span.ql-font-trebuchetms,
                  .compose-editor .ql-editor p.ql-font-trebuchetms,
                  .compose-editor .ql-editor div.ql-font-trebuchetms,
                  .compose-editor .ql-editor strong.ql-font-trebuchetms,
                  .compose-editor .ql-editor em.ql-font-trebuchetms,
                  .compose-editor .ql-editor *[class*="ql-font-trebuchetms"] {
                    font-family: 'Trebuchet MS', Helvetica, sans-serif !important;
                  }
                  
                  .compose-editor .ql-editor .ql-font-tahoma,
                  .compose-editor .ql-editor span.ql-font-tahoma,
                  .compose-editor .ql-editor p.ql-font-tahoma,
                  .compose-editor .ql-editor div.ql-font-tahoma,
                  .compose-editor .ql-editor strong.ql-font-tahoma,
                  .compose-editor .ql-editor em.ql-font-tahoma,
                  .compose-editor .ql-editor *[class*="ql-font-tahoma"] {
                    font-family: Tahoma, Geneva, sans-serif !important;
                  }
                  
                  .compose-editor .ql-editor .ql-font-couriernew,
                  .compose-editor .ql-editor span.ql-font-couriernew,
                  .compose-editor .ql-editor p.ql-font-couriernew,
                  .compose-editor .ql-editor div.ql-font-couriernew,
                  .compose-editor .ql-editor strong.ql-font-couriernew,
                  .compose-editor .ql-editor em.ql-font-couriernew,
                  .compose-editor .ql-editor *[class*="ql-font-couriernew"] {
                    font-family: 'Courier New', Courier, monospace !important;
                  }
                  
                  .compose-editor .ql-editor .ql-font-lucidasansunicode,
                  .compose-editor .ql-editor span.ql-font-lucidasansunicode,
                  .compose-editor .ql-editor p.ql-font-lucidasansunicode,
                  .compose-editor .ql-editor div.ql-font-lucidasansunicode,
                  .compose-editor .ql-editor strong.ql-font-lucidasansunicode,
                  .compose-editor .ql-editor em.ql-font-lucidasansunicode,
                  .compose-editor .ql-editor *[class*="ql-font-lucidasansunicode"] {
                    font-family: 'Lucida Sans Unicode', 'Lucida Grande', sans-serif !important;
                  }
                  
                  .compose-editor .ql-editor .ql-font-palatinolinotype,
                  .compose-editor .ql-editor span.ql-font-palatinolinotype,
                  .compose-editor .ql-editor p.ql-font-palatinolinotype,
                  .compose-editor .ql-editor div.ql-font-palatinolinotype,
                  .compose-editor .ql-editor strong.ql-font-palatinolinotype,
                  .compose-editor .ql-editor em.ql-font-palatinolinotype,
                  .compose-editor .ql-editor *[class*="ql-font-palatinolinotype"] {
                    font-family: 'Palatino Linotype', 'Book Antiqua', Palatino, serif !important;
                  }
                  
                  /* Force font application via inline styles - ReactQuill may use inline styles */
                  .compose-editor .ql-editor [style*="font-family: Arial"],
                  .compose-editor .ql-editor [style*="font-family:Arial"],
                  .compose-editor .ql-editor [style*="font-family: 'Arial'"],
                  .compose-editor .ql-editor [style*="font-family:'Arial'"] {
                    font-family: Arial, sans-serif !important;
                  }
                  .compose-editor .ql-editor [style*="font-family: 'Times New Roman'"],
                  .compose-editor .ql-editor [style*="font-family:'Times New Roman'"],
                  .compose-editor .ql-editor [style*="font-family: Times New Roman"],
                  .compose-editor .ql-editor [style*="font-family:TimesNewRoman"] {
                    font-family: 'Times New Roman', Times, serif !important;
                  }
                  .compose-editor .ql-editor [style*="font-family: Helvetica"],
                  .compose-editor .ql-editor [style*="font-family:Helvetica"],
                  .compose-editor .ql-editor [style*="font-family: 'Helvetica'"],
                  .compose-editor .ql-editor [style*="font-family:'Helvetica'"] {
                    font-family: Helvetica, Arial, sans-serif !important;
                  }
                  .compose-editor .ql-editor [style*="font-family: Georgia"],
                  .compose-editor .ql-editor [style*="font-family:Georgia"],
                  .compose-editor .ql-editor [style*="font-family: 'Georgia'"],
                  .compose-editor .ql-editor [style*="font-family:'Georgia'"] {
                    font-family: Georgia, serif !important;
                  }
                  .compose-editor .ql-editor [style*="font-family: Verdana"],
                  .compose-editor .ql-editor [style*="font-family:Verdana"],
                  .compose-editor .ql-editor [style*="font-family: 'Verdana'"],
                  .compose-editor .ql-editor [style*="font-family:'Verdana'"] {
                    font-family: Verdana, Geneva, sans-serif !important;
                  }
                  .compose-editor .ql-editor [style*="font-family: 'Trebuchet MS'"],
                  .compose-editor .ql-editor [style*="font-family:'Trebuchet MS'"],
                  .compose-editor .ql-editor [style*="font-family: Trebuchet MS"],
                  .compose-editor .ql-editor [style*="font-family:TrebuchetMS"] {
                    font-family: 'Trebuchet MS', Helvetica, sans-serif !important;
                  }
                  .compose-editor .ql-editor [style*="font-family: Tahoma"],
                  .compose-editor .ql-editor [style*="font-family:Tahoma"],
                  .compose-editor .ql-editor [style*="font-family: 'Tahoma'"],
                  .compose-editor .ql-editor [style*="font-family:'Tahoma'"] {
                    font-family: Tahoma, Geneva, sans-serif !important;
                  }
                  .compose-editor .ql-editor [style*="font-family: 'Courier New'"],
                  .compose-editor .ql-editor [style*="font-family:'Courier New'"],
                  .compose-editor .ql-editor [style*="font-family: Courier New"],
                  .compose-editor .ql-editor [style*="font-family:CourierNew"] {
                    font-family: 'Courier New', Courier, monospace !important;
                  }
                  .compose-editor .ql-editor [style*="font-family: 'Lucida Sans Unicode'"],
                  .compose-editor .ql-editor [style*="font-family:'Lucida Sans Unicode'"],
                  .compose-editor .ql-editor [style*="font-family: Lucida Sans Unicode"],
                  .compose-editor .ql-editor [style*="font-family:LucidaSansUnicode"] {
                    font-family: 'Lucida Sans Unicode', 'Lucida Grande', sans-serif !important;
                  }
                  .compose-editor .ql-editor [style*="font-family: 'Palatino Linotype'"],
                  .compose-editor .ql-editor [style*="font-family:'Palatino Linotype'"],
                  .compose-editor .ql-editor [style*="font-family: Palatino Linotype"],
                  .compose-editor .ql-editor [style*="font-family:PalatinoLinotype"] {
                    font-family: 'Palatino Linotype', 'Book Antiqua', Palatino, serif !important;
                  }
                  
                  /* Ensure font inheritance for elements WITHOUT font classes or inline styles */
                  .compose-editor .ql-editor p:not(.ql-font-arial):not(.ql-font-timesnewroman):not(.ql-font-helvetica):not(.ql-font-georgia):not(.ql-font-verdana):not(.ql-font-trebuchetms):not(.ql-font-tahoma):not(.ql-font-couriernew):not(.ql-font-lucidasansunicode):not(.ql-font-palatinolinotype):not([style*="font-family"]),
                  .compose-editor .ql-editor h1:not(.ql-font-arial):not(.ql-font-timesnewroman):not(.ql-font-helvetica):not(.ql-font-georgia):not(.ql-font-verdana):not(.ql-font-trebuchetms):not(.ql-font-tahoma):not(.ql-font-couriernew):not(.ql-font-lucidasansunicode):not(.ql-font-palatinolinotype):not([style*="font-family"]),
                  .compose-editor .ql-editor h2:not(.ql-font-arial):not(.ql-font-timesnewroman):not(.ql-font-helvetica):not(.ql-font-georgia):not(.ql-font-verdana):not(.ql-font-trebuchetms):not(.ql-font-tahoma):not(.ql-font-couriernew):not(.ql-font-lucidasansunicode):not(.ql-font-palatinolinotype):not([style*="font-family"]),
                  .compose-editor .ql-editor h3:not(.ql-font-arial):not(.ql-font-timesnewroman):not(.ql-font-helvetica):not(.ql-font-georgia):not(.ql-font-verdana):not(.ql-font-trebuchetms):not(.ql-font-tahoma):not(.ql-font-couriernew):not(.ql-font-lucidasansunicode):not(.ql-font-palatinolinotype):not([style*="font-family"]) {
                    font-family: inherit;
                  }
                  
                  /* Fix font picker dropdown labels - map tokens to friendly names */
                  .compose-editor .ql-picker.ql-font .ql-picker-label[data-value="arial"]::before,
                  .compose-editor .ql-picker.ql-font .ql-picker-item[data-value="arial"]::before {
                    content: 'Arial' !important;
                  }
                  .compose-editor .ql-picker.ql-font .ql-picker-label[data-value="timesnewroman"]::before,
                  .compose-editor .ql-picker.ql-font .ql-picker-item[data-value="timesnewroman"]::before {
                    content: 'Times New Roman' !important;
                  }
                  .compose-editor .ql-picker.ql-font .ql-picker-label[data-value="helvetica"]::before,
                  .compose-editor .ql-picker.ql-font .ql-picker-item[data-value="helvetica"]::before {
                    content: 'Helvetica' !important;
                  }
                  .compose-editor .ql-picker.ql-font .ql-picker-label[data-value="georgia"]::before,
                  .compose-editor .ql-picker.ql-font .ql-picker-item[data-value="georgia"]::before {
                    content: 'Georgia' !important;
                  }
                  .compose-editor .ql-picker.ql-font .ql-picker-label[data-value="verdana"]::before,
                  .compose-editor .ql-picker.ql-font .ql-picker-item[data-value="verdana"]::before {
                    content: 'Verdana' !important;
                  }
                  .compose-editor .ql-picker.ql-font .ql-picker-label[data-value="trebuchetms"]::before,
                  .compose-editor .ql-picker.ql-font .ql-picker-item[data-value="trebuchetms"]::before {
                    content: 'Trebuchet MS' !important;
                  }
                  .compose-editor .ql-picker.ql-font .ql-picker-label[data-value="tahoma"]::before,
                  .compose-editor .ql-picker.ql-font .ql-picker-item[data-value="tahoma"]::before {
                    content: 'Tahoma' !important;
                  }
                  .compose-editor .ql-picker.ql-font .ql-picker-label[data-value="couriernew"]::before,
                  .compose-editor .ql-picker.ql-font .ql-picker-item[data-value="couriernew"]::before {
                    content: 'Courier New' !important;
                  }
                  .compose-editor .ql-picker.ql-font .ql-picker-label[data-value="lucidasansunicode"]::before,
                  .compose-editor .ql-picker.ql-font .ql-picker-item[data-value="lucidasansunicode"]::before {
                    content: 'Lucida Sans Unicode' !important;
                  }
                  .compose-editor .ql-picker.ql-font .ql-picker-label[data-value="palatinolinotype"]::before,
                  .compose-editor .ql-picker.ql-font .ql-picker-item[data-value="palatinolinotype"]::before {
                    content: 'Palatino Linotype' !important;
                  }
                  
                  /* Hide default text and show our custom content */
                  .compose-editor .ql-picker.ql-font .ql-picker-label[data-value] span,
                  .compose-editor .ql-picker.ql-font .ql-picker-item[data-value] span {
                    display: none !important;
                  }
                  .compose-editor .ql-picker.ql-font .ql-picker-label[data-value]::after,
                  .compose-editor .ql-picker.ql-font .ql-picker-item[data-value]::after {
                    content: attr(data-value) !important;
                    display: inline-block !important;
                  }
                  
                  /* Override default "Sans Serif" label when no font is selected */
                  .compose-editor .ql-picker.ql-font .ql-picker-label:not([data-value])::before {
                    content: 'Sans Serif' !important;
                  }
                `}</style>
              </div>

              {/* Attachments */}
              {attachmentFiles.length > 0 && (
                <div className="px-4 py-2 border-t border-gray-200 flex-shrink-0 bg-white">
                  <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
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
              <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between flex-shrink-0 bg-white z-10">
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
                  {/* Delete Draft button - only show when editing a draft */}
                  {editingDraftId && (
                    <button
                      onClick={() => handleDeleteDraft(editingDraftId)}
                      disabled={deleteDraftMutation.isLoading}
                      className="flex items-center space-x-1 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Delete this draft permanently"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>{deleteDraftMutation.isLoading ? 'Deleting...' : 'Delete Draft'}</span>
                    </button>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleCloseCompose('discard')}
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

          {/* Draft Save Confirmation Dialog */}
          {showDraftConfirm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
              <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Save as Draft?
                </h3>
                <p className="text-sm text-gray-600 mb-6">
                  You have unsaved changes. Would you like to save this as a draft before closing?
                </p>
                <div className="flex items-center justify-end space-x-3">
                  <button
                    onClick={handleConfirmDiscard}
                    className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Discard
                  </button>
                  <button
                    onClick={handleCancelDraftConfirm}
                    className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmSaveDraft}
                    disabled={saveDraftMutation.isLoading}
                    className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saveDraftMutation.isLoading ? 'Saving...' : 'Save as Draft'}
                  </button>
            </div>
          </div>
            </div>
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
