import React, { useState } from 'react';
import { 
  PlusIcon, 
  CalendarIcon, 
  MapPinIcon, 
  GlobeAltIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  XMarkIcon,
  CheckIcon
} from '@heroicons/react/24/outline';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';

const ConferenceManagement = () => {
  const { user } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingConference, setEditingConference] = useState(null);
  const [deletingConference, setDeletingConference] = useState(null);
  const [viewingConference, setViewingConference] = useState(null);
  const [templateConference, setTemplateConference] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [activeTemplateStage, setActiveTemplateStage] = useState('stage1');
  const [formData, setFormData] = useState({
    name: '',
    venue: '',
    startDate: '',
    endDate: '',
    description: '',
    website: '',
    currency: 'USD',
    abstractDeadline: '',
    registrationDeadline: '',
    initialTemplateId: '',
    stage1TemplateId: '',
    stage2TemplateId: '',
    // Conference Settings
    stage1IntervalValue: 7,
    stage1IntervalUnit: 'days',
    stage1MaxFollowUps: 6,
    stage2IntervalValue: 3,
    stage2IntervalUnit: 'days',
    stage2MaxFollowUps: 6,
    skipWeekends: true,
    workingHoursStart: '09:00',
    workingHoursEnd: '17:00',
    timezone: 'UTC',
    // Team Assignment
    assignedTeamLeadId: '',
    assignedMemberIds: [],
    // Available team members for selection
    availableTeamLeads: [],
    availableMembers: [],
    initialTemplate: {
      subject: '',
      bodyHtml: '',
      bodyText: ''
    },
    stage1Template: {
      subject: '',
      bodyHtml: '',
      bodyText: ''
    },
    stage2Template: {
      subject: '',
      bodyHtml: '',
      bodyText: ''
    }
  });
  const [templateData, setTemplateData] = useState({
    stage1: {
      subject: '',
      bodyHtml: '',
      bodyText: ''
    },
    stage2: {
      subject: '',
      bodyHtml: '',
      bodyText: ''
    }
  });
  const queryClient = useQueryClient();

  // Fetch conferences with React Query
  const { data: conferences = [], isLoading, error, refetch } = useQuery('conferences', async () => {
    try {
      const response = await axios.get('/api/conferences');
      return response.data;
    } catch (error) {
      console.error('Error fetching conferences:', error);
      return []; // Return empty array on error
    }
  }, {
    retry: 1,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    cacheTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    // For Members, enable focus refetch for immediate updates when switching back to browser
    refetchOnWindowFocus: user?.role === 'Member',
  });

  // Fetch templates with React Query
  const { data: templates = [], isLoading: templatesLoading } = useQuery('templates', async () => {
    try {
      const response = await axios.get('/api/templates');
      return response.data;
    } catch (error) {
      console.error('Error fetching templates:', error);
      return []; // Return empty array on error
    }
  }, {
    retry: 1,
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Fetch users for team assignment
  const { data: users = [] } = useQuery('users', async () => {
    try {
      const response = await axios.get('/api/users');
      return response.data.users || [];
    } catch (error) {
      console.error('Error fetching users:', error);
      return []; // Return empty array on error
    }
  }, {
    retry: 1,
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Create conference mutation
  const createMutation = useMutation(async (conferenceData) => {
    const response = await axios.post('/api/conferences', conferenceData);
    return response.data;
  }, {
    onSuccess: () => {
      queryClient.invalidateQueries('conferences');
      toast.success('Conference created successfully');
      handleCloseModal();
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to create conference');
    }
  });

  // Update conference mutation
  const updateMutation = useMutation(async ({ id, data }) => {
    const response = await axios.put(`/api/conferences/${id}`, data);
    return response.data;
  }, {
    onSuccess: () => {
      queryClient.invalidateQueries('conferences');
      toast.success('Conference updated successfully');
      handleCloseModal();
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to update conference');
    }
  });

  // Delete conference mutation
  const deleteMutation = useMutation(async (id) => {
    const response = await axios.delete(`/api/conferences/${id}`);
    return response.data;
  }, {
    onSuccess: () => {
      queryClient.invalidateQueries('conferences');
      toast.success('Conference deleted successfully');
      setShowDeleteModal(false);
      setDeletingConference(null);
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to delete conference');
    }
  });

  // Update templates mutation
  const updateTemplatesMutation = useMutation(async ({ id, templates }) => {
    const response = await axios.put(`/api/conferences/${id}/templates`, templates);
    return response.data;
  }, {
    onSuccess: () => {
      queryClient.invalidateQueries('conferences');
      toast.success('Email templates updated successfully');
      setShowTemplateModal(false);
      setTemplateConference(null);
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to update templates');
    }
  });

  // Filter and search logic
  const filteredConferences = React.useMemo(() => {
    // Ensure conferences is an array and handle undefined/null cases
    if (!conferences || !Array.isArray(conferences)) {
      console.warn('Conferences data is not an array:', conferences);
      return [];
    }
    
    let filtered = conferences.filter(conference => {
      // Ensure conference is an object
      if (!conference || typeof conference !== 'object') {
        console.warn('Invalid conference object:', conference);
        return false;
      }
      return true;
    });

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(conference => {
        try {
          const name = (conference.name || '').toString().toLowerCase();
          const venue = (conference.venue || '').toString().toLowerCase();
          const description = (conference.description || '').toString().toLowerCase();
          const searchLower = searchTerm.toLowerCase();
          
          return name.includes(searchLower) ||
                 venue.includes(searchLower) ||
                 description.includes(searchLower);
        } catch (error) {
          console.warn('Error in search filter:', error, conference);
          return false;
        }
      });
    }

    // Status filter
    if (filterStatus !== 'all') {
      const now = new Date();
      filtered = filtered.filter(conference => {
        try {
          if (!conference.startDate || !conference.endDate) return false;
          
          const startDate = new Date(conference.startDate);
          const endDate = new Date(conference.endDate);
          
          // Check if dates are valid
          if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return false;
          
          switch (filterStatus) {
            case 'upcoming':
              return startDate > now;
            case 'ongoing':
              return startDate <= now && endDate >= now;
            case 'completed':
              return endDate < now;
            default:
              return true;
          }
        } catch (error) {
          console.warn('Error in status filter:', error, conference);
          return false;
        }
      });
    }

    // Sort
    try {
      filtered.sort((a, b) => {
        let aValue = a[sortBy] || '';
        let bValue = b[sortBy] || '';
        
        if (sortBy === 'startDate' || sortBy === 'endDate') {
          aValue = new Date(aValue);
          bValue = new Date(bValue);
          
          // Handle invalid dates
          if (isNaN(aValue.getTime())) aValue = new Date(0);
          if (isNaN(bValue.getTime())) bValue = new Date(0);
        }
        
        if (sortOrder === 'asc') {
          return aValue > bValue ? 1 : -1;
        } else {
          return aValue < bValue ? 1 : -1;
        }
      });
    } catch (error) {
      console.warn('Error in sorting:', error);
    }

    return filtered;
  }, [conferences, searchTerm, filterStatus, sortBy, sortOrder]);

  // Handler functions
  const handleCloseModal = () => {
    setShowModal(false);
    setEditingConference(null);
    setFormData({
      name: '',
      venue: '',
      startDate: '',
      endDate: '',
      description: '',
      website: '',
      currency: 'USD',
      abstractDeadline: '',
      registrationDeadline: '',
      initialTemplateId: '',
      stage1TemplateId: '',
      stage2TemplateId: '',
      // Conference Settings
      stage1IntervalValue: 7,
      stage1IntervalUnit: 'days',
      stage1MaxFollowUps: 6,
      stage2IntervalValue: 3,
      stage2IntervalUnit: 'days',
      stage2MaxFollowUps: 6,
      skipWeekends: true,
      workingHoursStart: '09:00',
      workingHoursEnd: '17:00',
      timezone: 'UTC',
      // Team Assignment
      assignedTeamLeadId: '',
      assignedMemberIds: [],
      // Available team members for selection
      availableTeamLeads: [],
      availableMembers: [],
      initialTemplate: {
        subject: '',
        bodyHtml: '',
        bodyText: ''
      },
      stage1Template: {
        subject: '',
        bodyHtml: '',
        bodyText: ''
      },
      stage2Template: {
        subject: '',
        bodyHtml: '',
        bodyText: ''
      }
    });
  };

  const handleCreate = () => {
    setEditingConference(null);
    setShowModal(true);
  };

  const handleEdit = (conference) => {
    setEditingConference(conference);
    
    // Parse interval settings from conference.settings or fallback to old format
    const settings = conference.settings || {};
    const followupIntervals = settings.followup_intervals || {};
    const maxAttempts = settings.max_attempts || {};
    
    // Stage 1 interval
    let stage1Value = 7, stage1Unit = 'days';
    if (followupIntervals.Stage1) {
      if (typeof followupIntervals.Stage1 === 'object') {
        stage1Value = followupIntervals.Stage1.value || 7;
        stage1Unit = followupIntervals.Stage1.unit || 'days';
      } else {
        stage1Value = followupIntervals.Stage1; // old format (number)
      }
    }
    
    // Stage 2 interval
    let stage2Value = 3, stage2Unit = 'days';
    if (followupIntervals.Stage2) {
      if (typeof followupIntervals.Stage2 === 'object') {
        stage2Value = followupIntervals.Stage2.value || 3;
        stage2Unit = followupIntervals.Stage2.unit || 'days';
      } else {
        stage2Value = followupIntervals.Stage2; // old format (number)
      }
    }
    
    setFormData({
      name: conference.name,
      venue: conference.venue,
      startDate: conference.startDate ? conference.startDate.split('T')[0] : '',
      endDate: conference.endDate ? conference.endDate.split('T')[0] : '',
      description: conference.description || '',
      website: conference.website || '',
      currency: conference.currency || 'USD',
      abstractDeadline: conference.abstractDeadline ? conference.abstractDeadline.split('T')[0] : '',
      registrationDeadline: conference.registrationDeadline ? conference.registrationDeadline.split('T')[0] : '',
      initialTemplateId: conference.initialTemplateId || '',
      stage1TemplateId: conference.stage1TemplateId || '',
      stage2TemplateId: conference.stage2TemplateId || '',
      // Conference Settings
      stage1IntervalValue: stage1Value,
      stage1IntervalUnit: stage1Unit,
      stage1MaxFollowUps: maxAttempts.Stage1 || 6,
      stage2IntervalValue: stage2Value,
      stage2IntervalUnit: stage2Unit,
      stage2MaxFollowUps: maxAttempts.Stage2 || 6,
      skipWeekends: settings.skip_weekends !== undefined ? settings.skip_weekends : true,
      workingHoursStart: settings.working_hours?.start || '09:00',
      workingHoursEnd: settings.working_hours?.end || '17:00',
      timezone: settings.timezone || 'UTC',
      initialTemplate: conference.initialTemplate || {
        subject: '',
        bodyHtml: '',
        bodyText: ''
      },
      stage1Template: conference.stage1Template || {
        subject: '',
        bodyHtml: '',
        bodyText: ''
      },
      stage2Template: conference.stage2Template || {
        subject: '',
        bodyHtml: '',
        bodyText: ''
      }
    });
    setShowModal(true);
  };

  const handleView = (conference) => {
    setViewingConference(conference);
    setShowViewModal(true);
  };

  const handleDelete = (conference) => {
    setDeletingConference(conference);
    setShowDeleteModal(true);
  };

  const handleTemplates = (conference) => {
    setTemplateConference(conference);
    setTemplateData({
      stage1: conference.stage1Template || {
        subject: '',
        bodyHtml: '',
        bodyText: ''
      },
      stage2: conference.stage2Template || {
        subject: '',
        bodyHtml: '',
        bodyText: ''
      }
    });
    setShowTemplateModal(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Transform interval data to new format
    const submitData = {
      ...formData,
      settings: {
        followup_intervals: {
          Stage1: { value: parseInt(formData.stage1IntervalValue), unit: formData.stage1IntervalUnit },
          Stage2: { value: parseInt(formData.stage2IntervalValue), unit: formData.stage2IntervalUnit }
        },
        max_attempts: {
          Stage1: parseInt(formData.stage1MaxFollowUps),
          Stage2: parseInt(formData.stage2MaxFollowUps)
        },
        skip_weekends: formData.skipWeekends,
        timezone: formData.timezone,
        working_hours: {
          start: formData.workingHoursStart,
          end: formData.workingHoursEnd
        }
      }
    };
    
    if (editingConference) {
      updateMutation.mutate({ id: editingConference.id, data: submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  const handleTemplateSubmit = (e) => {
    e.preventDefault();
    if (templateConference) {
      updateTemplatesMutation.mutate({ 
        id: templateConference.id, 
        templates: templateData 
      });
    }
  };

  const handleDeleteConfirm = () => {
    if (deletingConference) {
      deleteMutation.mutate(deletingConference.id);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleTemplateChange = (e) => {
    const { name, value } = e.target;
    setTemplateData(prev => ({
      ...prev,
      [activeTemplateStage]: {
        ...prev[activeTemplateStage],
        [name]: value
      }
    }));
  };

  const handleCloseTemplateModal = () => {
    setShowTemplateModal(false);
    setTemplateConference(null);
    setTemplateData({
      stage1: { subject: '', bodyHtml: '', bodyText: '' },
      stage2: { subject: '', bodyHtml: '', bodyText: '' }
    });
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString();
  };

  const getStatusBadge = (conference) => {
    const now = new Date();
    const startDate = new Date(conference.startDate);
    const endDate = new Date(conference.endDate);
    
    if (startDate > now) {
      return <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">Upcoming</span>;
    } else if (startDate <= now && endDate >= now) {
      return <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">Ongoing</span>;
    } else {
      return <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">Completed</span>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-600 text-center">
          <p className="text-lg font-semibold">Error loading conferences</p>
          <p className="text-sm">{error.message}</p>
          <button 
            onClick={() => refetch()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Search and Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Conferences</h1>
            <p className="text-gray-600">Manage your conference events and settings</p>
          </div>
          <button
            onClick={handleCreate}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <PlusIcon className="h-5 w-5" />
            Add Conference
          </button>
        </div>

        {/* Search and Filter Controls */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search conferences..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            <option value="upcoming">Upcoming</option>
            <option value="ongoing">Ongoing</option>
            <option value="completed">Completed</option>
          </select>

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="name">Sort by Name</option>
            <option value="startDate">Sort by Start Date</option>
            <option value="endDate">Sort by End Date</option>
            <option value="venue">Sort by Venue</option>
          </select>

          {/* Sort Order */}
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </div>
      </div>

      {/* Conferences Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredConferences.map((conference) => (
          <div key={conference.id} className="bg-white rounded-lg shadow-md border border-gray-200 p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{conference.name}</h3>
                {getStatusBadge(conference)}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleView(conference)}
                  className="p-1 text-gray-400 hover:text-blue-600"
                  title="View"
                >
                  <EyeIcon className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleEdit(conference)}
                  className="p-1 text-gray-400 hover:text-yellow-600"
                  title="Edit"
                >
                  <PencilIcon className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleTemplates(conference)}
                  className="p-1 text-gray-400 hover:text-purple-600"
                  title="Email Templates"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </button>
                <button
                  onClick={() => handleDelete(conference)}
                  className="p-1 text-gray-400 hover:text-red-600"
                  title="Delete"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-gray-600">
                <MapPinIcon className="h-4 w-4" />
                <span className="text-sm">{conference.venue}</span>
              </div>
              
              <div className="flex items-center gap-2 text-gray-600">
                <CalendarIcon className="h-4 w-4" />
                <span className="text-sm">
                  {formatDate(conference.startDate)} - {formatDate(conference.endDate)}
                </span>
              </div>
              
              {conference.website && (
                <div className="flex items-center gap-2 text-gray-600">
                  <GlobeAltIcon className="h-4 w-4" />
                  <a 
                    href={conference.website} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline"
                  >
                    {conference.website}
                  </a>
                </div>
              )}
              
              {conference.description && (
                <p className="text-sm text-gray-600 line-clamp-2">{conference.description}</p>
              )}
              
              <div className="pt-2 border-t border-gray-100">
                <div className="text-xs text-gray-500">
                  <p>Abstract Deadline: {formatDate(conference.abstractDeadline)}</p>
                  <p>Registration Deadline: {formatDate(conference.registrationDeadline)}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {filteredConferences.length === 0 && (
        <div className="text-center py-12">
          <CalendarIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No conferences found</h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchTerm || filterStatus !== 'all' 
              ? 'Try adjusting your search or filter criteria.'
              : conferences.length === 0
                ? "You haven't been assigned to any conferences yet. Contact your Team Lead to get access to conference data."
                : 'Get started by creating a new conference.'
            }
          </p>
          {!searchTerm && filterStatus === 'all' && conferences.length > 0 && (
            <div className="mt-6">
              <button
                onClick={handleCreate}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 mx-auto"
              >
                <PlusIcon className="h-5 w-5" />
                Add Conference
              </button>
            </div>
          )}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl mx-auto max-h-[95vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-xl">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {editingConference ? 'Edit Conference' : 'Create Conference'}
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {editingConference ? 'Update conference details and email templates' : 'Set up a new conference with email automation'}
                  </p>
                </div>
                <button
                  onClick={handleCloseModal}
                  className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
            </div>
            <div className="p-6">

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Information */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-4">Basic Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Conference Name *
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white"
                      placeholder="Enter conference name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Venue *
                    </label>
                    <input
                      type="text"
                      name="venue"
                      value={formData.venue}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white"
                      placeholder="Enter venue name"
                    />
                  </div>
                </div>
              </div>

              {/* Conference Dates */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-4">Conference Dates</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Start Date *
                    </label>
                    <input
                      type="date"
                      name="startDate"
                      value={formData.startDate}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      End Date *
                    </label>
                    <input
                      type="date"
                      name="endDate"
                      value={formData.endDate}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Additional Information */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-4">Additional Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Website
                    </label>
                    <input
                      type="url"
                      name="website"
                      value={formData.website}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white"
                      placeholder="https://example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Currency
                    </label>
                    <select
                      name="currency"
                      value={formData.currency}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white"
                    >
                      <option value="USD">USD - US Dollar</option>
                      <option value="EUR">EUR - Euro</option>
                      <option value="GBP">GBP - British Pound</option>
                      <option value="INR">INR - Indian Rupee</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Important Deadlines */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-4">Important Deadlines</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Abstract Deadline
                    </label>
                    <input
                      type="date"
                      name="abstractDeadline"
                      value={formData.abstractDeadline}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Registration Deadline
                    </label>
                    <input
                      type="date"
                      name="registrationDeadline"
                      value={formData.registrationDeadline}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Conference Settings */}
              <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-lg p-6 border border-orange-100">
                <div className="flex items-center mb-6">
                  <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center mr-4">
                    <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900">Follow-up Settings</h4>
                    <p className="text-sm text-gray-600">Configure automated follow-up intervals and limits</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Stage 1 Settings */}
                  <div className="bg-white rounded-lg p-4 border border-orange-200">
                    <div className="flex items-center mb-4">
                      <div className="w-6 h-6 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                        <span className="text-blue-600 font-semibold text-sm">1</span>
                      </div>
                      <h5 className="text-sm font-semibold text-gray-900">Abstract Submission Stage</h5>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Follow-up Interval
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            name="stage1IntervalValue"
                            value={formData.stage1IntervalValue}
                            onChange={handleInputChange}
                            min="1"
                            max="999"
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white"
                            placeholder="7"
                          />
                          <select
                            name="stage1IntervalUnit"
                            value={formData.stage1IntervalUnit}
                            onChange={handleInputChange}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white"
                          >
                            <option value="minutes">Minutes</option>
                            <option value="hours">Hours</option>
                            <option value="days">Days</option>
                          </select>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Time between follow-up emails</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Max Follow-ups
                        </label>
                        <input
                          type="number"
                          name="stage1MaxFollowUps"
                          value={formData.stage1MaxFollowUps}
                          onChange={handleInputChange}
                          min="1"
                          max="20"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white"
                          placeholder="6"
                        />
                        <p className="text-xs text-gray-500 mt-1">Maximum number of follow-up emails</p>
                      </div>
                    </div>
                  </div>

                  {/* Stage 2 Settings */}
                  <div className="bg-white rounded-lg p-4 border border-orange-200">
                    <div className="flex items-center mb-4">
                      <div className="w-6 h-6 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                        <span className="text-green-600 font-semibold text-sm">2</span>
                      </div>
                      <h5 className="text-sm font-semibold text-gray-900">Registration Stage</h5>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Follow-up Interval
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            name="stage2IntervalValue"
                            value={formData.stage2IntervalValue}
                            onChange={handleInputChange}
                            min="1"
                            max="999"
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200 bg-white"
                            placeholder="3"
                          />
                          <select
                            name="stage2IntervalUnit"
                            value={formData.stage2IntervalUnit}
                            onChange={handleInputChange}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200 bg-white"
                          >
                            <option value="minutes">Minutes</option>
                            <option value="hours">Hours</option>
                            <option value="days">Days</option>
                          </select>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Time between follow-up emails</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Max Follow-ups
                        </label>
                        <input
                          type="number"
                          name="stage2MaxFollowUps"
                          value={formData.stage2MaxFollowUps}
                          onChange={handleInputChange}
                          min="1"
                          max="20"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200 bg-white"
                          placeholder="6"
                        />
                        <p className="text-xs text-gray-500 mt-1">Maximum number of follow-up emails</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Global Settings */}
                <div className="mt-6 bg-white rounded-lg p-4 border border-orange-200">
                  <h5 className="text-sm font-semibold text-gray-900 mb-4">Global Settings</h5>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          name="skipWeekends"
                          checked={formData.skipWeekends}
                          onChange={(e) => setFormData(prev => ({ ...prev, skipWeekends: e.target.checked }))}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="ml-2 text-sm text-gray-700">Skip Weekends</span>
                      </label>
                      <p className="text-xs text-gray-500 mt-1">Don't send emails on Saturday & Sunday</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Working Hours Start
                      </label>
                      <input
                        type="time"
                        name="workingHoursStart"
                        value={formData.workingHoursStart}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Working Hours End
                      </label>
                      <input
                        type="time"
                        name="workingHoursEnd"
                        value={formData.workingHoursEnd}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200 bg-white"
                      />
                    </div>
                  </div>
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Timezone
                    </label>
                    <select
                      name="timezone"
                      value={formData.timezone}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200 bg-white"
                    >
                      <option value="UTC">UTC - Coordinated Universal Time</option>
                      <option value="America/New_York">EST - Eastern Time</option>
                      <option value="America/Chicago">CST - Central Time</option>
                      <option value="America/Denver">MST - Mountain Time</option>
                      <option value="America/Los_Angeles">PST - Pacific Time</option>
                      <option value="Europe/London">GMT - Greenwich Mean Time</option>
                      <option value="Europe/Paris">CET - Central European Time</option>
                      <option value="Asia/Tokyo">JST - Japan Standard Time</option>
                      <option value="Asia/Shanghai">CST - China Standard Time</option>
                      <option value="Asia/Kolkata">IST - India Standard Time</option>
                      <option value="Australia/Sydney">AEST - Australian Eastern Time</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Team Assignment */}
              <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg p-6 border border-blue-100">
                <div className="flex items-center mb-6">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-4">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900">Team Assignment</h4>
                    <p className="text-sm text-gray-600">Assign conference to team members</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Team Lead Assignment */}
                  <div className="bg-white rounded-lg p-4 border border-blue-200">
                    <div className="flex items-center mb-4">
                      <div className="w-6 h-6 bg-purple-100 rounded-lg flex items-center justify-center mr-3">
                        <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <h5 className="text-sm font-semibold text-gray-900">Team Lead</h5>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Assign Team Lead
                      </label>
                      <select
                        name="assignedTeamLeadId"
                        value={formData.assignedTeamLeadId}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white"
                      >
                        <option value="">Select Team Lead</option>
                        {users.filter(user => user.role === 'TeamLead').map(user => (
                          <option key={user.id} value={user.id}>
                            {user.name} ({user.email})
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-1">Team Lead will manage this conference</p>
                    </div>
                  </div>

                  {/* Members Assignment */}
                  <div className="bg-white rounded-lg p-4 border border-blue-200">
                    <div className="flex items-center mb-4">
                      <div className="w-6 h-6 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                        <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                        </svg>
                      </div>
                      <h5 className="text-sm font-semibold text-gray-900">Team Members</h5>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Assign Members
                      </label>
                      <div className="space-y-2 max-h-32 overflow-y-auto border border-gray-200 rounded-lg p-2">
                        {(users || []).filter(user => user.role === 'Member').map(user => (
                          <label key={user.id} className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={(formData.assignedMemberIds || []).includes(user.id)}
                              onChange={(e) => {
                                const memberId = user.id;
                                if (e.target.checked) {
                                  setFormData(prev => ({
                                    ...prev,
                                    assignedMemberIds: [...(prev.assignedMemberIds || []), memberId]
                                  }));
                                } else {
                                  setFormData(prev => ({
                                    ...prev,
                                    assignedMemberIds: (prev.assignedMemberIds || []).filter(id => id !== memberId)
                                  }));
                                }
                              }}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <span className="text-sm text-gray-700">{user.name} ({user.email})</span>
                          </label>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Select members to work on this conference</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white resize-none"
                  placeholder="Enter conference description..."
                />
              </div>

              {/* Email Templates Section */}
              <div className="border-t border-gray-200 pt-8">
                <div className="mb-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Email Templates</h3>
                  <p className="text-sm text-gray-600">Configure email templates for each stage of your conference workflow</p>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Initial Invitation Template Selection */}
                  <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-6 border border-purple-100">
                    <div className="flex items-center mb-4">
                      <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center mr-3">
                        <span className="text-purple-600 font-semibold text-sm">1</span>
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900">Initial Invitation</h4>
                        <p className="text-xs text-gray-600">First contact with participants</p>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Select Template
                        </label>
                        <select
                          name="initialTemplateId"
                          value={formData.initialTemplateId || ''}
                          onChange={(e) => {
                            const templateId = e.target.value;
                            const selectedTemplate = templates?.find(t => t.id === templateId);
                            setFormData(prev => ({
                              ...prev,
                              initialTemplateId: templateId,
                              initialTemplate: selectedTemplate ? {
                                subject: selectedTemplate.subject,
                                bodyHtml: selectedTemplate.bodyHtml,
                                bodyText: selectedTemplate.bodyText
                              } : { subject: '', bodyHtml: '', bodyText: '' }
                            }));
                          }}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 bg-white"
                        >
                          <option value="">Choose Initial Template</option>
                          {templates?.filter(t => t.stage === 'initial_invitation').map(template => (
                            <option key={template.id} value={template.id}>
                              {template.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Initial Template Preview */}
                      {formData.initialTemplate && formData.initialTemplate.subject && (
                        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                          <h5 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                            <span className="w-2 h-2 bg-purple-400 rounded-full mr-2"></span>
                            Preview
                          </h5>
                          <div className="space-y-2">
                            <p className="text-sm font-medium text-gray-900">Subject: {formData.initialTemplate.subject}</p>
                            <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded border-l-2 border-purple-200">
                              {formData.initialTemplate.bodyText || formData.initialTemplate.bodyHtml?.replace(/<[^>]*>/g, '')}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Stage 1 Template Selection */}
                  <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-6 border border-blue-100">
                    <div className="flex items-center mb-4">
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                        <span className="text-blue-600 font-semibold text-sm">2</span>
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900">Abstract Submission</h4>
                        <p className="text-xs text-gray-600">Follow-up for abstract submissions</p>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Select Template
                        </label>
                        <select
                          name="stage1TemplateId"
                          value={formData.stage1TemplateId || ''}
                          onChange={(e) => {
                            const templateId = e.target.value;
                            const selectedTemplate = templates?.find(t => t.id === templateId);
                            setFormData(prev => ({
                              ...prev,
                              stage1TemplateId: templateId,
                              stage1Template: selectedTemplate ? {
                                subject: selectedTemplate.subject,
                                bodyHtml: selectedTemplate.bodyHtml,
                                bodyText: selectedTemplate.bodyText
                              } : { subject: '', bodyHtml: '', bodyText: '' }
                            }));
                          }}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white"
                        >
                          <option value="">Choose Stage 1 Template</option>
                          {templates?.filter(t => t.stage === 'abstract_submission').map(template => (
                            <option key={template.id} value={template.id}>
                              {template.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Stage 1 Template Preview */}
                      {formData.stage1Template && formData.stage1Template.subject && (
                        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                          <h5 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                            <span className="w-2 h-2 bg-blue-400 rounded-full mr-2"></span>
                            Preview
                          </h5>
                          <div className="space-y-2">
                            <p className="text-sm font-medium text-gray-900">Subject: {formData.stage1Template.subject}</p>
                            <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded border-l-2 border-blue-200">
                              {formData.stage1Template.bodyText || formData.stage1Template.bodyHtml?.replace(/<[^>]*>/g, '')}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Stage 2 Template Selection */}
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-100">
                    <div className="flex items-center mb-4">
                      <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                        <span className="text-green-600 font-semibold text-sm">3</span>
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900">Registration</h4>
                        <p className="text-xs text-gray-600">Final registration reminders</p>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Select Template
                        </label>
                        <select
                          name="stage2TemplateId"
                          value={formData.stage2TemplateId || ''}
                          onChange={(e) => {
                            const templateId = e.target.value;
                            const selectedTemplate = templates?.find(t => t.id === templateId);
                            setFormData(prev => ({
                              ...prev,
                              stage2TemplateId: templateId,
                              stage2Template: selectedTemplate ? {
                                subject: selectedTemplate.subject,
                                bodyHtml: selectedTemplate.bodyHtml,
                                bodyText: selectedTemplate.bodyText
                              } : { subject: '', bodyHtml: '', bodyText: '' }
                            }));
                          }}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200 bg-white"
                        >
                          <option value="">Choose Stage 2 Template</option>
                          {templates?.filter(t => t.stage === 'registration').map(template => (
                            <option key={template.id} value={template.id}>
                              {template.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Stage 2 Template Preview */}
                      {formData.stage2Template && formData.stage2Template.subject && (
                        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                          <h5 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                            <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
                            Preview
                          </h5>
                          <div className="space-y-2">
                            <p className="text-sm font-medium text-gray-900">Subject: {formData.stage2Template.subject}</p>
                            <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded border-l-2 border-green-200">
                              {formData.stage2Template.bodyText || formData.stage2Template.bodyHtml?.replace(/<[^>]*>/g, '')}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Template Management Section */}
                <div className="mt-8 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-4">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div>
                        <h4 className="text-lg font-semibold text-gray-900">Template Management</h4>
                        <p className="text-sm text-gray-600">Create and manage email templates for your campaigns</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        window.location.href = '/templates';
                      }}
                      className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 shadow-sm"
                    >
                      Manage Templates
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-4 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-6 py-3 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-all duration-200 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isLoading || updateMutation.isLoading}
                  className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium shadow-sm flex items-center gap-2"
                >
                  {createMutation.isLoading || updateMutation.isLoading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <CheckIcon className="h-4 w-4" />
                  )}
                  {editingConference ? 'Update Conference' : 'Create Conference'}
                </button>
              </div>
            </form>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {showViewModal && viewingConference && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">Conference Details</h2>
              <button
                onClick={() => setShowViewModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">{viewingConference.name}</h3>
                {getStatusBadge(viewingConference)}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <MapPinIcon className="h-5 w-5 text-gray-400" />
                  <span className="text-gray-600">{viewingConference.venue}</span>
                </div>

                <div className="flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5 text-gray-400" />
                  <span className="text-gray-600">
                    {formatDate(viewingConference.startDate)} - {formatDate(viewingConference.endDate)}
                  </span>
                </div>

                {viewingConference.website && (
                  <div className="flex items-center gap-2">
                    <GlobeAltIcon className="h-5 w-5 text-gray-400" />
                    <a 
                      href={viewingConference.website} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {viewingConference.website}
                    </a>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <span className="text-gray-600">Currency: {viewingConference.currency}</span>
                </div>
              </div>

              {viewingConference.description && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Description</h4>
                  <p className="text-gray-600">{viewingConference.description}</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                <div>
                  <h4 className="font-medium text-gray-900 mb-1">Abstract Deadline</h4>
                  <p className="text-gray-600">{formatDate(viewingConference.abstractDeadline)}</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 mb-1">Registration Deadline</h4>
                  <p className="text-gray-600">{formatDate(viewingConference.registrationDeadline)}</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-6">
              <button
                onClick={() => setShowViewModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setShowViewModal(false);
                  handleEdit(viewingConference);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
              >
                <PencilIcon className="h-4 w-4" />
                Edit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && deletingConference && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <TrashIcon className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900">Delete Conference</h3>
                <p className="text-sm text-gray-500">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-gray-600 mb-6">
              Are you sure you want to delete <strong>"{deletingConference.name}"</strong>? 
              This will permanently remove the conference and all associated data.
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeletingConference(null);
                }}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleteMutation.isLoading}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
              >
                {deleteMutation.isLoading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <TrashIcon className="h-4 w-4" />
                )}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Template Management Modal */}
      {showTemplateModal && templateConference && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                Email Templates - {templateConference.name}
              </h2>
              <button
                onClick={handleCloseTemplateModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            {/* Stage Selection Tabs */}
            <div className="flex space-x-1 mb-6 bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => setActiveTemplateStage('stage1')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  activeTemplateStage === 'stage1'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Stage 1 - Abstract Submission
              </button>
              <button
                onClick={() => setActiveTemplateStage('stage2')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  activeTemplateStage === 'stage2'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Stage 2 - Registration
              </button>
            </div>

            <form onSubmit={handleTemplateSubmit} className="space-y-6">
              {/* Template Form */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Subject
                  </label>
                  <input
                    type="text"
                    name="subject"
                    value={templateData[activeTemplateStage].subject}
                    onChange={handleTemplateChange}
                    placeholder="Enter email subject..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    HTML Body
                  </label>
                  <textarea
                    name="bodyHtml"
                    value={templateData[activeTemplateStage].bodyHtml}
                    onChange={handleTemplateChange}
                    rows={12}
                    placeholder="Enter HTML email body..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Text Body
                  </label>
                  <textarea
                    name="bodyText"
                    value={templateData[activeTemplateStage].bodyText}
                    onChange={handleTemplateChange}
                    rows={8}
                    placeholder="Enter plain text email body..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  />
                </div>
              </div>

              {/* Available Variables */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">Available Variables</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <code className="bg-gray-200 px-2 py-1 rounded text-xs">{'{{client_name}}'}</code>
                    <span className="text-gray-600">Client name</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="bg-gray-200 px-2 py-1 rounded text-xs">{'{{conference_name}}'}</code>
                    <span className="text-gray-600">Conference name</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="bg-gray-200 px-2 py-1 rounded text-xs">{'{{conference_date}}'}</code>
                    <span className="text-gray-600">Conference date</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="bg-gray-200 px-2 py-1 rounded text-xs">{'{{conference_venue}}'}</code>
                    <span className="text-gray-600">Conference venue</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="bg-gray-200 px-2 py-1 rounded text-xs">{'{{abstract_deadline}}'}</code>
                    <span className="text-gray-600">Abstract deadline</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="bg-gray-200 px-2 py-1 rounded text-xs">{'{{registration_deadline}}'}</code>
                    <span className="text-gray-600">Registration deadline</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="bg-gray-200 px-2 py-1 rounded text-xs">{'{{abstract_submission_link}}'}</code>
                    <span className="text-gray-600">Abstract submission link</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="bg-gray-200 px-2 py-1 rounded text-xs">{'{{registration_link}}'}</code>
                    <span className="text-gray-600">Registration link</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="bg-gray-200 px-2 py-1 rounded text-xs">{'{{conference_website}}'}</code>
                    <span className="text-gray-600">Conference website</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="bg-gray-200 px-2 py-1 rounded text-xs">{'{{unsubscribe_link}}'}</code>
                    <span className="text-gray-600">Unsubscribe link</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={handleCloseTemplateModal}
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateTemplatesMutation.isLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {updateTemplatesMutation.isLoading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <CheckIcon className="h-4 w-4" />
                  )}
                  Save Templates
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConferenceManagement;