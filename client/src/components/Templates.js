import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  Plus,
  Edit,
  Trash2,
  Eye,
  Copy,
  Mail,
  Paperclip,
  X,
  Download,
  Upload,
  Code,
  User,
  Building,
  Globe,
  Calendar,
  MapPin
} from 'lucide-react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';

const Templates = () => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    stage: '',
    subject: '',
    bodyHtml: '',
    bodyText: '',
    description: '',
    variables: [],
    sendAfterDays: 1,
    followUpNumber: 1
  });
  const [previewData, setPreviewData] = useState({
    name: 'John Doe',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    phone: '+1-555-0123',
    country: 'United States',
    organization: 'Example Corp',
    position: 'Senior Manager',
    conferenceName: 'Tech Conference 2024',
    conferenceDate: 'December 15, 2024 to December 17, 2024',
    conferenceStartDate: 'December 15, 2024',
    conferenceEndDate: 'December 17, 2024',
    conferenceVenue: 'Convention Center, New York',
    conferenceWebsite: 'https://techconf2024.com',
    conferenceDescription: 'Annual Technology Conference',
    abstractDeadline: 'November 30, 2024',
    registrationDeadline: 'December 1, 2024',
    currentDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    currentYear: new Date().getFullYear()
  });
  const queryClient = useQueryClient();

  // Dynamic variables available for templates
  const availableVariables = [
    // Client variables
    { key: 'name', label: 'Client Name', icon: User, description: 'Full name of the client (John Doe)' },
    { key: 'firstName', label: 'First Name', icon: User, description: 'Client first name only (John)' },
    { key: 'lastName', label: 'Last Name', icon: User, description: 'Client last name only (Doe)' },
    { key: 'email', label: 'Client Email', icon: Mail, description: 'Email address of the client' },
    { key: 'phone', label: 'Client Phone', icon: Mail, description: 'Phone number of the client' },
    { key: 'country', label: 'Client Country', icon: Globe, description: 'Country of the client' },
    { key: 'organization', label: 'Organization', icon: Building, description: 'Client organization/company' },
    { key: 'position', label: 'Position', icon: User, description: 'Client job position' },
    // Conference variables
    { key: 'conferenceName', label: 'Conference Name', icon: Building, description: 'Name of the conference' },
    { key: 'conferenceVenue', label: 'Conference Venue', icon: MapPin, description: 'Venue of the conference' },
    { key: 'conferenceDate', label: 'Conference Date Range', icon: Calendar, description: 'Full date range (June 15 to 17, 2024)' },
    { key: 'conferenceStartDate', label: 'Start Date', icon: Calendar, description: 'Conference start date only' },
    { key: 'conferenceEndDate', label: 'End Date', icon: Calendar, description: 'Conference end date only' },
    { key: 'abstractDeadline', label: 'Abstract Deadline', icon: Calendar, description: 'Deadline for abstract submission' },
    { key: 'registrationDeadline', label: 'Registration Deadline', icon: Calendar, description: 'Deadline for registration' },
    { key: 'conferenceWebsite', label: 'Conference Website', icon: Globe, description: 'Conference website URL' },
    { key: 'conferenceDescription', label: 'Conference Description', icon: Building, description: 'Conference description' },
    // System variables
    { key: 'currentDate', label: 'Current Date', icon: Calendar, description: 'Today\'s date' },
    { key: 'currentYear', label: 'Current Year', icon: Calendar, description: 'Current year (2025)' }
  ];

  const { data: templates, isLoading } = useQuery('templates', async () => {
    const response = await axios.get('/api/templates');
    return response.data;
  });

  const addTemplateMutation = useMutation(async (templateData) => {
    const response = await axios.post('/api/templates', templateData);
    return response.data;
  }, {
    onSuccess: () => {
      queryClient.invalidateQueries('templates');
      setShowAddModal(false);
      toast.success('Template created successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to create template');
    }
  });

  const updateTemplateMutation = useMutation(async ({ id, data }) => {
    const response = await axios.put(`/api/templates/${id}`, data);
    return response.data;
  }, {
    onSuccess: () => {
      queryClient.invalidateQueries('templates');
      setShowEditModal(false);
      setSelectedTemplate(null);
      toast.success('Template updated successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to update template');
    }
  });

  const deleteTemplateMutation = useMutation(async (id) => {
    const response = await axios.delete(`/api/templates/${id}`);
    return response.data;
  }, {
    onSuccess: () => {
      queryClient.invalidateQueries('templates');
      toast.success('Template deleted successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to delete template');
    }
  });

  const getStageBadge = (stage) => {
    const stageClasses = {
      'initial_invitation': 'bg-purple-100 text-purple-800',
      'abstract_submission': 'bg-blue-100 text-blue-800',
      'registration': 'bg-green-100 text-green-800'
    };
    return `status-badge ${stageClasses[stage] || 'bg-gray-100 text-gray-800'}`;
  };

  const getStageName = (stage) => {
    const stageNames = {
      'initial_invitation': 'Initial Invitation',
      'abstract_submission': 'Abstract Submission',
      'registration': 'Registration'
    };
    return stageNames[stage] || stage;
  };

  const handleEdit = (template) => {
    setSelectedTemplate(template);
    setShowEditModal(true);
  };

  const handleDelete = (template) => {
    if (window.confirm(`Are you sure you want to delete "${template.name}"? This action cannot be undone.`)) {
      deleteTemplateMutation.mutate(template.id);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    const newAttachments = files.map(file => ({
      id: Date.now() + Math.random(),
      file,
      name: file.name,
      size: file.size,
      type: file.type
    }));
    setAttachments(prev => [...prev, ...newAttachments]);
  };

  const removeAttachment = (id) => {
    setAttachments(prev => prev.filter(att => att.id !== id));
  };

  const insertVariable = (variable) => {
    const textarea = document.getElementById('bodyHtml');
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = textarea.value;
      const before = text.substring(0, start);
      const after = text.substring(end, text.length);
      const newText = before + `{${variable}}` + after;
      
      setFormData(prev => ({
        ...prev,
        bodyHtml: newText
      }));
      
      // Focus back to textarea
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + variable.length + 2, start + variable.length + 2);
      }, 0);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      stage: '',
      subject: '',
      bodyHtml: '',
      bodyText: '',
      description: '',
      variables: [],
      sendAfterDays: 1,
      followUpNumber: 1
    });
    setAttachments([]);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const templateData = {
      ...formData,
      attachments: attachments.map(att => ({
        name: att.name,
        size: att.size,
        type: att.type
      }))
    };
    
    if (selectedTemplate) {
      updateTemplateMutation.mutate({ id: selectedTemplate.id, data: templateData });
    } else {
      addTemplateMutation.mutate(templateData);
    }
  };

  const handleCloseModal = () => {
    setShowAddModal(false);
    setShowEditModal(false);
    setSelectedTemplate(null);
    resetForm();
  };

  const handlePreview = (template) => {
    setSelectedTemplate(template);
    setShowPreviewModal(true);
  };

  const renderPreview = (template) => {
    // Use the same sample data as previewData state
    const sampleData = {
      // Client variables
      name: 'John Doe',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      phone: '+1-555-0123',
      country: 'United States',
      organization: 'Example Corp',
      position: 'Senior Manager',
      // Conference variables
      conferenceName: 'Tech Conference 2024',
      conferenceVenue: 'Convention Center, New York',
      conferenceDate: 'December 15, 2024 to December 17, 2024',
      conferenceStartDate: 'December 15, 2024',
      conferenceEndDate: 'December 17, 2024',
      abstractDeadline: 'November 30, 2024',
      registrationDeadline: 'December 1, 2024',
      conferenceWebsite: 'https://techconf2024.com',
      conferenceDescription: 'Annual Technology Conference',
      // System variables
      currentDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      currentYear: new Date().getFullYear()
    };

    let renderedSubject = template.subject || '';
    let renderedBody = template.bodyHtml || '';

    // Replace all variable formats: {var}, {{var}}, {{var.name}}, {{var_name}}
    Object.keys(sampleData).forEach(key => {
      const value = sampleData[key];
      // Replace {variable}
      renderedSubject = renderedSubject.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
      renderedBody = renderedBody.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
      // Replace {{variable}}
      renderedSubject = renderedSubject.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
      renderedBody = renderedBody.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    });

    return { subject: renderedSubject, body: renderedBody };
  };

  return (
    <div className="space-y-6">
      {/* Enhanced Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl shadow-sm border border-blue-100 p-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Email Templates</h1>
            <p className="text-gray-600 text-lg">Create and manage dynamic email templates with attachments</p>
            <div className="mt-4 flex items-center space-x-4 text-sm text-gray-500">
              <div className="flex items-center">
                <Code className="h-4 w-4 mr-1" />
                Dynamic Variables
              </div>
              <div className="flex items-center">
                <Paperclip className="h-4 w-4 mr-1" />
                File Attachments
              </div>
              <div className="flex items-center">
                <Mail className="h-4 w-4 mr-1" />
                Multi-Stage Templates
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 font-medium shadow-sm flex items-center"
          >
            <Plus className="h-5 w-5 mr-2" />
            Create Template
          </button>
        </div>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          <div className="col-span-full flex justify-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : templates?.length === 0 ? (
          <div className="col-span-full text-center py-8">
            <Mail className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No templates created yet</p>
          </div>
        ) : (
          templates?.map((template) => (
            <div key={template.id} className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-lg transition-all duration-200 p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">{template.name}</h3>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStageBadge(template.stage)}`}>
                    {getStageName(template.stage)}
                  </span>
                </div>
              </div>
              
              <div className="space-y-3 mb-4">
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">Subject:</p>
                  <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded border-l-2 border-blue-200">
                    {template.subject}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">Preview:</p>
                  <p className="text-sm text-gray-500 bg-gray-50 p-2 rounded line-clamp-3">
                    {template.bodyText?.substring(0, 120) || template.bodyHtml?.replace(/<[^>]*>/g, '').substring(0, 120)}...
                  </p>
                </div>
              </div>
              
              <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                <div className="flex items-center space-x-2 text-xs text-gray-500">
                  <span>Version {template.version}</span>
                  {template.attachments && template.attachments.length > 0 && (
                    <span className="flex items-center">
                      <Paperclip className="h-3 w-3 mr-1" />
                      {template.attachments.length} files
                    </span>
                  )}
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handlePreview(template)}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200"
                    title="Preview"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleEdit(template)}
                    className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all duration-200"
                    title="Edit"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(template)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200"
                    title="Delete"
                    disabled={deleteTemplateMutation.isLoading}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Template Modal */}
      <Transition appear show={showAddModal} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowAddModal(false)}>
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
                <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-white shadow-2xl transition-all">
                  {/* Modal Header */}
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <Dialog.Title className="text-2xl font-bold text-gray-900">
                          Create New Template
                        </Dialog.Title>
                        <p className="text-sm text-gray-600 mt-1">
                          Create dynamic email templates with attachments and variables
                        </p>
                      </div>
                      <button
                        onClick={handleCloseModal}
                        className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200"
                      >
                        <X className="h-6 w-6" />
                      </button>
                    </div>
                  </div>

                  {/* Modal Content */}
                  <div className="p-6">
                    <form onSubmit={handleSubmit} className="space-y-6">
                      {/* Basic Information */}
                      <div className="bg-gray-50 rounded-lg p-4">
                        <h4 className="text-sm font-semibold text-gray-900 mb-4">Basic Information</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Template Name *
                            </label>
                            <input
                              type="text"
                              name="name"
                              value={formData.name}
                              onChange={handleChange}
                              required
                              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white"
                              placeholder="Enter template name"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Stage *
                            </label>
                            <select
                              name="stage"
                              value={formData.stage}
                              onChange={handleChange}
                              required
                              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white"
                            >
                              <option value="">Select Stage</option>
                              <option value="initial_invitation">Initial Invitation</option>
                              <option value="abstract_submission">Abstract Submission</option>
                              <option value="registration">Registration</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* Email Content */}
                      <div className="bg-gray-50 rounded-lg p-4">
                        <h4 className="text-sm font-semibold text-gray-900 mb-4">Email Content</h4>
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Subject *
                            </label>
                            <input
                              type="text"
                              name="subject"
                              value={formData.subject}
                              onChange={handleChange}
                              required
                              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white"
                              placeholder="Use {name}, {conferenceName} for variables"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Email Body (HTML) *
                            </label>
                            <textarea
                              id="bodyHtml"
                              name="bodyHtml"
                              value={formData.bodyHtml}
                              onChange={handleChange}
                              rows={8}
                              required
                              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white resize-none"
                              placeholder="Use {name}, {conferenceName}, {email}, {country} for variables"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Dynamic Variables */}
                      <div className="bg-gray-50 rounded-lg p-4">
                        <h4 className="text-sm font-semibold text-gray-900 mb-4">Dynamic Variables</h4>
                        <p className="text-sm text-gray-600 mb-4">Click on any variable to insert it into your email body:</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {availableVariables.map((variable) => {
                            const IconComponent = variable.icon;
                            return (
                              <button
                                key={variable.key}
                                type="button"
                                onClick={() => insertVariable(variable.key)}
                                className="flex items-center p-3 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all duration-200 group"
                                title={variable.description}
                              >
                                <IconComponent className="h-4 w-4 text-gray-500 group-hover:text-blue-600 mr-2" />
                                <span className="text-sm font-medium text-gray-700 group-hover:text-blue-900">
                                  {variable.label}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                          <p className="text-xs text-blue-700">
                            <strong>Available variables:</strong> {availableVariables.map(v => `{${v.key}}`).join(', ')}
                          </p>
                        </div>
                      </div>

                      {/* File Attachments */}
                      <div className="bg-gray-50 rounded-lg p-4">
                        <h4 className="text-sm font-semibold text-gray-900 mb-4">File Attachments</h4>
                        <div className="space-y-4">
                          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors duration-200">
                            <input
                              type="file"
                              multiple
                              onChange={handleFileUpload}
                              className="hidden"
                              id="file-upload"
                            />
                            <label htmlFor="file-upload" className="cursor-pointer">
                              <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                              <p className="text-sm text-gray-600">Click to upload files or drag and drop</p>
                              <p className="text-xs text-gray-500">PDF, DOC, DOCX, PNG, JPG up to 10MB each</p>
                            </label>
                          </div>
                          
                          {attachments.length > 0 && (
                            <div className="space-y-2">
                              <h5 className="text-sm font-medium text-gray-700">Attached Files:</h5>
                              {attachments.map((attachment) => (
                                <div key={attachment.id} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg">
                                  <div className="flex items-center">
                                    <Paperclip className="h-4 w-4 text-gray-400 mr-2" />
                                    <span className="text-sm text-gray-700">{attachment.name}</span>
                                    <span className="text-xs text-gray-500 ml-2">
                                      ({(attachment.size / 1024).toFixed(1)} KB)
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => removeAttachment(attachment.id)}
                                    className="text-red-400 hover:text-red-600 p-1"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Form Actions */}
                      <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
                        <button
                          type="button"
                          onClick={handleCloseModal}
                          className="px-6 py-3 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-all duration-200 font-medium"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={addTemplateMutation.isLoading}
                          className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium shadow-sm"
                        >
                          {addTemplateMutation.isLoading ? 'Creating...' : 'Create Template'}
                        </button>
                      </div>
                    </form>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Edit Template Modal */}
      <Transition appear show={showEditModal} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowEditModal(false)}>
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
                <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                  <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900 mb-4">
                    Edit Template
                  </Dialog.Title>
                  
                  <TemplateForm 
                    template={selectedTemplate}
                    onSubmit={(data) => updateTemplateMutation.mutate({ id: selectedTemplate.id, data })}
                    onCancel={() => {
                      setShowEditModal(false);
                      setSelectedTemplate(null);
                    }}
                    loading={updateTemplateMutation.isLoading}
                  />
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Preview Modal */}
      <Transition appear show={showPreviewModal} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowPreviewModal(false)}>
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
                <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                  <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900 mb-4">
                    Template Preview
                  </Dialog.Title>
                  
                  {selectedTemplate && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Subject
                        </label>
                        <div className="p-3 bg-gray-50 rounded-lg">
                          {renderPreview(selectedTemplate).subject}
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Body
                        </label>
                        <div 
                          className="p-3 bg-gray-50 rounded-lg max-h-96 overflow-y-auto"
                          dangerouslySetInnerHTML={{ __html: renderPreview(selectedTemplate).body }}
                        />
                      </div>
                      
                      <div className="flex justify-end pt-4">
                        <button
                          onClick={() => setShowPreviewModal(false)}
                          className="btn-secondary"
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  )}
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
};

const TemplateForm = ({ template, onSubmit, onCancel, loading }) => {
  const [formData, setFormData] = useState({
    name: template?.name || '',
    stage: template?.stage || '',
    subject: template?.subject || '',
    bodyHtml: template?.bodyHtml || '',
    bodyText: template?.bodyText || ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleBodyHtmlChange = (e) => {
    const html = e.target.value;
    const text = html.replace(/<[^>]*>/g, ''); // Strip HTML tags for text version
    setFormData({
      ...formData,
      bodyHtml: html,
      bodyText: text
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Template Name
          </label>
          <input
            type="text"
            name="name"
            required
            value={formData.name}
            onChange={handleChange}
            className="input-field"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Stage
          </label>
          <select
            name="stage"
            required
            value={formData.stage}
            onChange={handleChange}
            className="input-field"
          >
            <option value="">Select Stage</option>
            <option value="initial_invitation">Initial Invitation</option>
            <option value="abstract_submission">Abstract Submission</option>
            <option value="registration">Registration</option>
          </select>
        </div>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Subject
        </label>
        <input
          type="text"
          name="subject"
          required
          value={formData.subject}
          onChange={handleChange}
          className="input-field"
          placeholder="Use {Name}, {ConferenceName} for variables"
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Email Body (HTML)
        </label>
        <textarea
          name="bodyHtml"
          rows="8"
          required
          value={formData.bodyHtml}
          onChange={handleBodyHtmlChange}
          className="input-field"
          placeholder="Use {Name}, {ConferenceName}, {Email}, {Country} for variables"
        />
        <p className="text-xs text-gray-500 mt-1">
          Available variables: {'{Name}'}, {'{ConferenceName}'}, {'{Email}'}, {'{Country}'}
        </p>
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
          {loading ? 'Saving...' : template ? 'Update Template' : 'Create Template'}
        </button>
      </div>
    </form>
  );
};

export default Templates;
