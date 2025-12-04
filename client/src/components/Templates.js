import React, { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  Plus,
  Edit,
  Trash2,
  Eye,
  Mail,
  Paperclip,
  X,
  Upload,
  Download,
  Code,
  User,
  Building,
  Globe,
  Calendar,
  MapPin,
  File
} from 'lucide-react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import ReactQuill, { Quill } from 'react-quill';
import 'react-quill/dist/quill.snow.css';

// Register font whitelist to match email compose editor
const Font = Quill.import('formats/font');
Font.whitelist = [
  'arial',
  'calistomt',
  'cambria',
  'couriernew',
  'georgia',
  'helvetica',
  'lucidasansunicode',
  'palatinolinotype',
  'tahoma',
  'timesnewroman',
  'trebuchetms',
  'verdana'
];
Quill.register(Font, true);

// Register numeric font sizes using style attributor (pixel values)
const SizeStyle = Quill.import('attributors/style/size');
SizeStyle.whitelist = ['8px', '9px', '10px', '11px', '12px', '14px', '16px', '18px', '20px', '22px', '24px'];
Quill.register(SizeStyle, true);

const quillModules = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    [{ font: ['arial', 'calistomt', 'cambria', 'couriernew', 'georgia', 'helvetica', 'lucidasansunicode', 'palatinolinotype', 'tahoma', 'timesnewroman', 'trebuchetms', 'verdana'] }],
    [{ size: ['8px', '9px', '10px', '11px', '12px', '14px', '16px', '18px', '20px', '22px', '24px', false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ color: [] }, { background: [] }],
    [{ list: 'ordered' }, { list: 'bullet' }],
    [{ align: [] }],
    ['link', 'image'],
    ['clean']
  ]
};

const quillFormats = [
  'header',
  'font',
  'size',
  'bold',
  'italic',
  'underline',
  'strike',
  'color',
  'background',
  'list',
  'bullet',
  'align',
  'link',
  'image'
];

const TEMPLATE_EDITOR_STYLES = `
  .template-editor .ql-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    font-size: 14px;
    min-height: 0;
    border-radius: 0 0 0.5rem 0.5rem;
  }
  .template-editor .ql-editor {
    flex: 1;
    min-height: 250px;
    padding: 12px;
    text-align: left;
    line-height: 1.6;
    word-wrap: break-word;
    overflow-wrap: break-word;
  }
  .template-editor .ql-editor.ql-blank::before {
    left: 12px;
    right: 12px;
    text-align: left;
    font-style: normal;
    color: #9ca3af;
  }
  .template-editor .ql-toolbar {
    border-top: 1px solid #e5e7eb;
    border-left: 1px solid #e5e7eb;
    border-right: 1px solid #e5e7eb;
    border-bottom: none;
    padding: 8px;
    border-radius: 0.5rem 0.5rem 0 0;
  }
  .template-editor .ql-toolbar .ql-formats {
    margin-right: 8px;
  }
  .template-editor .ql-toolbar .ql-picker.ql-font {
    max-width: 160px;
  }
  .template-editor .ql-toolbar .ql-picker.ql-font .ql-picker-label,
  .template-editor .ql-toolbar .ql-picker.ql-font .ql-picker-label::before,
  .template-editor .ql-toolbar .ql-picker.ql-font .ql-picker-label::after {
    white-space: nowrap;
  }
  .template-editor .ql-toolbar .ql-picker.ql-font .ql-picker-label {
    overflow: hidden;
    text-overflow: ellipsis;
    display: inline-block;
    max-width: 160px;
    vertical-align: middle;
  }
  .template-editor .ql-toolbar .ql-picker.ql-font .ql-picker-options {
    min-width: 180px;
    max-height: 300px;
    overflow-y: auto;
    overflow-x: hidden;
  }
  .template-editor .ql-toolbar .ql-picker.ql-font .ql-picker-item,
  .template-editor .ql-toolbar .ql-picker.ql-font .ql-picker-item::before,
  .template-editor .ql-toolbar .ql-picker.ql-font .ql-picker-item::after {
    white-space: nowrap;
  }
  /* Font family assignments */
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
  .ql-font-cambria,
  *[class*="ql-font-cambria"] {
    font-family: Cambria, serif !important;
  }
  .ql-font-calistomt,
  *[class*="ql-font-calistomt"] {
    font-family: 'Calisto MT', serif !important;
  }
  .template-editor .ql-picker.ql-font .ql-picker-label[data-value="arial"]::before,
  .template-editor .ql-picker.ql-font .ql-picker-item[data-value="arial"]::before { content: 'Arial' !important; }
  .template-editor .ql-picker.ql-font .ql-picker-label[data-value="timesnewroman"]::before,
  .template-editor .ql-picker.ql-font .ql-picker-item[data-value="timesnewroman"]::before { content: 'Times New Roman' !important; }
  .template-editor .ql-picker.ql-font .ql-picker-label[data-value="helvetica"]::before,
  .template-editor .ql-picker.ql-font .ql-picker-item[data-value="helvetica"]::before { content: 'Helvetica' !important; }
  .template-editor .ql-picker.ql-font .ql-picker-label[data-value="georgia"]::before,
  .template-editor .ql-picker.ql-font .ql-picker-item[data-value="georgia"]::before { content: 'Georgia' !important; }
  .template-editor .ql-picker.ql-font .ql-picker-label[data-value="verdana"]::before,
  .template-editor .ql-picker.ql-font .ql-picker-item[data-value="verdana"]::before { content: 'Verdana' !important; }
  .template-editor .ql-picker.ql-font .ql-picker-label[data-value="trebuchetms"]::before,
  .template-editor .ql-picker.ql-font .ql-picker-item[data-value="trebuchetms"]::before { content: 'Trebuchet MS' !important; }
  .template-editor .ql-picker.ql-font .ql-picker-label[data-value="tahoma"]::before,
  .template-editor .ql-picker.ql-font .ql-picker-item[data-value="tahoma"]::before { content: 'Tahoma' !important; }
  .template-editor .ql-picker.ql-font .ql-picker-label[data-value="couriernew"]::before,
  .template-editor .ql-picker.ql-font .ql-picker-item[data-value="couriernew"]::before { content: 'Courier New' !important; }
  .template-editor .ql-picker.ql-font .ql-picker-label[data-value="lucidasansunicode"]::before,
  .template-editor .ql-picker.ql-font .ql-picker-item[data-value="lucidasansunicode"]::before { content: 'Lucida Sans Unicode' !important; }
  .template-editor .ql-picker.ql-font .ql-picker-label[data-value="palatinolinotype"]::before,
  .template-editor .ql-picker.ql-font .ql-picker-item[data-value="palatinolinotype"]::before { content: 'Palatino Linotype' !important; }
  .template-editor .ql-picker.ql-font .ql-picker-label[data-value="cambria"]::before,
  .template-editor .ql-picker.ql-font .ql-picker-item[data-value="cambria"]::before { content: 'Cambria' !important; }
  .template-editor .ql-picker.ql-font .ql-picker-label[data-value="calistomt"]::before,
  .template-editor .ql-picker.ql-font .ql-picker-item[data-value="calistomt"]::before { content: 'Calisto MT' !important; }
  .template-editor .ql-picker.ql-font .ql-picker-label:not([data-value])::before {
    content: 'Sans Serif' !important;
  }
  /* Font Size Styles - Numeric sizes like MS Word */
  /* Apply to all possible elements that Quill might use */
  .template-editor .ql-editor .ql-size-8,
  .template-editor .ql-editor span.ql-size-8,
  .template-editor .ql-editor p.ql-size-8,
  .template-editor .ql-editor div.ql-size-8,
  .template-editor .ql-editor strong.ql-size-8,
  .template-editor .ql-editor em.ql-size-8,
  .template-editor .ql-editor u.ql-size-8,
  .template-editor .ql-editor *[class*="ql-size-8"] {
    font-size: 8px !important;
  }
  .template-editor .ql-editor .ql-size-9,
  .template-editor .ql-editor span.ql-size-9,
  .template-editor .ql-editor p.ql-size-9,
  .template-editor .ql-editor div.ql-size-9,
  .template-editor .ql-editor strong.ql-size-9,
  .template-editor .ql-editor em.ql-size-9,
  .template-editor .ql-editor u.ql-size-9,
  .template-editor .ql-editor *[class*="ql-size-9"] {
    font-size: 9px !important;
  }
  .template-editor .ql-editor .ql-size-10,
  .template-editor .ql-editor span.ql-size-10,
  .template-editor .ql-editor p.ql-size-10,
  .template-editor .ql-editor div.ql-size-10,
  .template-editor .ql-editor strong.ql-size-10,
  .template-editor .ql-editor em.ql-size-10,
  .template-editor .ql-editor u.ql-size-10,
  .template-editor .ql-editor *[class*="ql-size-10"] {
    font-size: 10px !important;
  }
  .template-editor .ql-editor .ql-size-11,
  .template-editor .ql-editor span.ql-size-11,
  .template-editor .ql-editor p.ql-size-11,
  .template-editor .ql-editor div.ql-size-11,
  .template-editor .ql-editor strong.ql-size-11,
  .template-editor .ql-editor em.ql-size-11,
  .template-editor .ql-editor u.ql-size-11,
  .template-editor .ql-editor *[class*="ql-size-11"] {
    font-size: 11px !important;
  }
  .template-editor .ql-editor .ql-size-12,
  .template-editor .ql-editor span.ql-size-12,
  .template-editor .ql-editor p.ql-size-12,
  .template-editor .ql-editor div.ql-size-12,
  .template-editor .ql-editor strong.ql-size-12,
  .template-editor .ql-editor em.ql-size-12,
  .template-editor .ql-editor u.ql-size-12,
  .template-editor .ql-editor *[class*="ql-size-12"] {
    font-size: 12px !important;
  }
  .template-editor .ql-editor .ql-size-14,
  .template-editor .ql-editor span.ql-size-14,
  .template-editor .ql-editor p.ql-size-14,
  .template-editor .ql-editor div.ql-size-14,
  .template-editor .ql-editor strong.ql-size-14,
  .template-editor .ql-editor em.ql-size-14,
  .template-editor .ql-editor u.ql-size-14,
  .template-editor .ql-editor *[class*="ql-size-14"] {
    font-size: 14px !important;
  }
  .template-editor .ql-editor .ql-size-16,
  .template-editor .ql-editor span.ql-size-16,
  .template-editor .ql-editor p.ql-size-16,
  .template-editor .ql-editor div.ql-size-16,
  .template-editor .ql-editor strong.ql-size-16,
  .template-editor .ql-editor em.ql-size-16,
  .template-editor .ql-editor u.ql-size-16,
  .template-editor .ql-editor *[class*="ql-size-16"] {
    font-size: 16px !important;
  }
  .template-editor .ql-editor .ql-size-18,
  .template-editor .ql-editor span.ql-size-18,
  .template-editor .ql-editor p.ql-size-18,
  .template-editor .ql-editor div.ql-size-18,
  .template-editor .ql-editor strong.ql-size-18,
  .template-editor .ql-editor em.ql-size-18,
  .template-editor .ql-editor u.ql-size-18,
  .template-editor .ql-editor *[class*="ql-size-18"] {
    font-size: 18px !important;
  }
  .template-editor .ql-editor .ql-size-20,
  .template-editor .ql-editor span.ql-size-20,
  .template-editor .ql-editor p.ql-size-20,
  .template-editor .ql-editor div.ql-size-20,
  .template-editor .ql-editor strong.ql-size-20,
  .template-editor .ql-editor em.ql-size-20,
  .template-editor .ql-editor u.ql-size-20,
  .template-editor .ql-editor *[class*="ql-size-20"] {
    font-size: 20px !important;
  }
  .template-editor .ql-editor .ql-size-22,
  .template-editor .ql-editor span.ql-size-22,
  .template-editor .ql-editor p.ql-size-22,
  .template-editor .ql-editor div.ql-size-22,
  .template-editor .ql-editor strong.ql-size-22,
  .template-editor .ql-editor em.ql-size-22,
  .template-editor .ql-editor u.ql-size-22,
  .template-editor .ql-editor *[class*="ql-size-22"] {
    font-size: 22px !important;
  }
  .template-editor .ql-editor .ql-size-24,
  .template-editor .ql-editor span.ql-size-24,
  .template-editor .ql-editor p.ql-size-24,
  .template-editor .ql-editor div.ql-size-24,
  .template-editor .ql-editor strong.ql-size-24,
  .template-editor .ql-editor em.ql-size-24,
  .template-editor .ql-editor u.ql-size-24,
  .template-editor .ql-editor *[class*="ql-size-24"] {
    font-size: 24px !important;
  }
  /* Font Size Picker - Show numeric values (SizeStyle uses pixel values like "8px") */
  .template-editor .ql-picker.ql-size .ql-picker-label[data-value="8px"]::before,
  .template-editor .ql-picker.ql-size .ql-picker-item[data-value="8px"]::before {
    content: '8' !important;
  }
  .template-editor .ql-picker.ql-size .ql-picker-label[data-value="9px"]::before,
  .template-editor .ql-picker.ql-size .ql-picker-item[data-value="9px"]::before {
    content: '9' !important;
  }
  .template-editor .ql-picker.ql-size .ql-picker-label[data-value="10px"]::before,
  .template-editor .ql-picker.ql-size .ql-picker-item[data-value="10px"]::before {
    content: '10' !important;
  }
  .template-editor .ql-picker.ql-size .ql-picker-label[data-value="11px"]::before,
  .template-editor .ql-picker.ql-size .ql-picker-item[data-value="11px"]::before {
    content: '11' !important;
  }
  .template-editor .ql-picker.ql-size .ql-picker-label[data-value="12px"]::before,
  .template-editor .ql-picker.ql-size .ql-picker-item[data-value="12px"]::before {
    content: '12' !important;
  }
  .template-editor .ql-picker.ql-size .ql-picker-label[data-value="14px"]::before,
  .template-editor .ql-picker.ql-size .ql-picker-item[data-value="14px"]::before {
    content: '14' !important;
  }
  .template-editor .ql-picker.ql-size .ql-picker-label[data-value="16px"]::before,
  .template-editor .ql-picker.ql-size .ql-picker-item[data-value="16px"]::before {
    content: '16' !important;
  }
  .template-editor .ql-picker.ql-size .ql-picker-label[data-value="18px"]::before,
  .template-editor .ql-picker.ql-size .ql-picker-item[data-value="18px"]::before {
    content: '18' !important;
  }
  .template-editor .ql-picker.ql-size .ql-picker-label[data-value="20px"]::before,
  .template-editor .ql-picker.ql-size .ql-picker-item[data-value="20px"]::before {
    content: '20' !important;
  }
  .template-editor .ql-picker.ql-size .ql-picker-label[data-value="22px"]::before,
  .template-editor .ql-picker.ql-size .ql-picker-item[data-value="22px"]::before {
    content: '22' !important;
  }
  .template-editor .ql-picker.ql-size .ql-picker-label[data-value="24px"]::before,
  .template-editor .ql-picker.ql-size .ql-picker-item[data-value="24px"]::before {
    content: '24' !important;
  }
  /* Hide default text in size picker */
  .template-editor .ql-picker.ql-size .ql-picker-label[data-value] span,
  .template-editor .ql-picker.ql-size .ql-picker-item[data-value] span {
    display: none !important;
  }
  .template-editor .ql-picker.ql-size .ql-picker-label[data-value]::after {
    display: none !important;
  }
  /* Show default "Normal" when no size is selected */
  .template-editor .ql-picker.ql-size .ql-picker-label:not([data-value])::before {
    content: 'Normal' !important;
  }
  .template-editor .ql-picker.ql-size .ql-picker-options {
    max-height: 300px;
    overflow-y: auto;
    overflow-x: hidden;
  }
`;

const stripHtml = (html) => {
  if (!html) return '';
  if (typeof window === 'undefined') {
    return html.replace(/<[^>]+>/g, ' ').trim();
  }
  const div = window.document.createElement('div');
  div.innerHTML = html;
  return (div.textContent || div.innerText || '').trim();
};

const readFileAsBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const { result } = reader;
      if (typeof result === 'string') {
        const base64 = result.includes(',')
          ? result.split(',')[1]
          : result;
        resolve(base64);
      } else {
        reject(new Error('Unable to read file'));
      }
    };
    reader.onerror = () => reject(reader.error || new Error('Unable to read file'));
    reader.readAsDataURL(file);
  });

const getInitialTemplateForm = () => ({
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

const Templates = () => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const bodyEditorRef = useRef(null);
  const [formData, setFormData] = useState(getInitialTemplateForm());
  const [activeTab, setActiveTab] = useState('templates');
  const [activeDraftId, setActiveDraftId] = useState(null);
  const [draftIdBeingDeleted, setDraftIdBeingDeleted] = useState(null);
  const queryClient = useQueryClient();

  // Dynamic variables available for templates
  const availableVariables = [
    // Client variables
    { key: 'name', label: 'Client Name', icon: User, description: 'Full name of the client (John Doe)' },
    { key: 'email', label: 'Client Email', icon: Mail, description: 'Email address of the client' },
    { key: 'country', label: 'Client Country', icon: Globe, description: 'Country of the client' },
    // Conference variables
    { key: 'conferenceName', label: 'Conference Name', icon: Building, description: 'Name of the conference' },
    { key: 'conferenceShortName', label: 'Conference Short Name', icon: Building, description: 'Short / abbreviated name of the conference' },
    { key: 'conferenceVenue', label: 'Conference Venue', icon: MapPin, description: 'Venue of the conference' },
    { key: 'conferenceDate', label: 'Conference Date Range', icon: Calendar, description: 'Full date range (June 15 to 17, 2024)' },
    { key: 'conferenceStartDate', label: 'Start Date', icon: Calendar, description: 'Conference start date only' },
    { key: 'conferenceEndDate', label: 'End Date', icon: Calendar, description: 'Conference end date only' },
    { key: 'abstractDeadline', label: 'Abstract Deadline', icon: Calendar, description: 'Deadline for abstract submission' },
    { key: 'registrationDeadline', label: 'Registration Deadline', icon: Calendar, description: 'Deadline for registration' },
    { key: 'conferenceWebsite', label: 'Conference Website', icon: Globe, description: 'Conference website URL' },
    { key: 'conferenceAbstractSubmissionLink', label: 'Abstract Submission Link', icon: Globe, description: 'Link for abstract submissions' },
    { key: 'conferenceRegistrationLink', label: 'Registration Link', icon: Globe, description: 'Registration portal link' },
    { key: 'conferenceDescription', label: 'Conference Description', icon: Building, description: 'Conference description' },
    // System variables
    { key: 'currentDate', label: 'Current Date', icon: Calendar, description: 'Today\'s date' },
    { key: 'currentYear', label: 'Current Year', icon: Calendar, description: 'Current year (2025)' }
  ];

  const { data: templateDrafts = [], isLoading: draftsLoading } = useQuery('template-drafts', async () => {
    const response = await axios.get('/api/template-drafts');
    return response.data;
  });

  const createTemplateDraftMutation = useMutation(async (draftData) => {
    const response = await axios.post('/api/template-drafts', draftData);
    return response.data;
  }, {
    onSuccess: (data) => {
      queryClient.invalidateQueries('template-drafts');
      setActiveDraftId(data.id);
      setActiveTab('drafts');
      if (data.attachments) {
        setAttachments(
          data.attachments.map((att, idx) => ({
            ...att,
            id: att.id || `${data.id}-${idx}`
          }))
        );
      }
      toast.success('Draft saved');
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to save draft');
    }
  });

  const updateTemplateDraftMutation = useMutation(async ({ id, data }) => {
    const response = await axios.put(`/api/template-drafts/${id}`, data);
    return response.data;
  }, {
    onSuccess: (data) => {
      queryClient.invalidateQueries('template-drafts');
      setActiveDraftId(data.id);
      setActiveTab('drafts');
      if (data.attachments) {
        setAttachments(
          data.attachments.map((att, idx) => ({
            ...att,
            id: att.id || `${data.id}-${idx}`
          }))
        );
      }
      toast.success('Draft updated');
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to update draft');
    }
  });

  const deleteTemplateDraftMutation = useMutation(
    async ({ id }) => {
      await axios.delete(`/api/template-drafts/${id}`);
      return id;
    },
    {
      onMutate: (variables) => {
        setDraftIdBeingDeleted(variables.id);
      },
      onSuccess: (_, variables) => {
        queryClient.invalidateQueries('template-drafts');
        if (variables?.closeOnSuccess) {
          resetForm();
          setShowAddModal(false);
        }
        if (!variables?.silent) {
          toast.success('Draft deleted');
        }
      },
      onError: (error) => {
        toast.error(error.response?.data?.error || 'Failed to delete draft');
      },
      onSettled: () => {
        setDraftIdBeingDeleted(null);
      }
    }
  );

  const isSavingDraft = createTemplateDraftMutation.isLoading || updateTemplateDraftMutation.isLoading;
  const isDeletingDraft = deleteTemplateDraftMutation.isLoading;

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
      setActiveTab('templates');
      toast.success('Template created successfully');
      if (activeDraftId) {
        deleteTemplateDraftMutation.mutate({ id: activeDraftId, silent: true });
      }
      setActiveDraftId(null);
      resetForm();
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
      setActiveDraftId(null);
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
      // Internal stages used by backend
      'abstract_submission': 'bg-blue-100 text-blue-800',
      'registration': 'bg-green-100 text-green-800',
      // Virtual stage for UI only – mapped to abstract_submission + followUpNumber=1
      'initial': 'bg-purple-100 text-purple-800'
    };
    return `status-badge ${stageClasses[stage] || 'bg-gray-100 text-gray-800'}`;
  };

  const getStageName = (stage) => {
    const stageNames = {
      // Internal stages
      'abstract_submission': 'Abstract Submission',
      'registration': 'Registration',
      // Virtual stage for first email in the sequence
      'initial': 'Initial Email'
    };
    return stageNames[stage] || stage;
  };

  const handleEdit = (template) => {
    if (!template) return;
    setActiveDraftId(null);
    setActiveTab('templates');
    // Map backend template to UI form.
    // For "Initial" emails we keep backend stage as abstract_submission but
    // show a virtual "initial" stage in the dropdown for clarity.
    const isInitial =
      template.stage === 'abstract_submission' &&
      (template.followUpNumber === 0 || template.followUpNumber === 1);

    const uiStage = isInitial ? 'initial' : template.stage;

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

  const handleBodyChange = (value) => {
    setFormData(prev => ({
      ...prev,
      bodyHtml: value,
      bodyText: stripHtml(value)
    }));
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) {
      return;
    }

    try {
      const processed = await Promise.all(
        files.map(async (file) => {
          const base64Content = await readFileAsBase64(file);
          return {
            id: `${Date.now()}-${Math.random()}`,
            name: file.name,
            filename: file.name,
            size: file.size,
            type: file.type || 'application/octet-stream',
            contentType: file.type || 'application/octet-stream',
            encoding: 'base64',
            content: base64Content
          };
        })
      );

      setAttachments(prev => [...prev, ...processed]);
    } catch (error) {
      console.error('Error reading attachment:', error);
      toast.error('Failed to read one or more attachments');
    } finally {
      if (e.target) {
        e.target.value = '';
      }
    }
  };

  const removeAttachment = (id) => {
    setAttachments(prev => prev.filter(att => att.id !== id));
  };

  const buildDraftPayload = () => ({
    name: formData.name || '',
    // Map virtual "initial" stage to backend "abstract_submission"
    stage: formData.stage === 'initial' ? 'abstract_submission' : (formData.stage || null),
    subject: formData.subject || '',
    bodyHtml: formData.bodyHtml || '',
    bodyText: stripHtml(formData.bodyHtml || ''),
    description: formData.description || '',
    variables: formData.variables || [],
    sendAfterDays: formData.sendAfterDays || 1,
    followUpNumber: formData.followUpNumber || 1,
    attachments: attachments.map(att => ({
      id: att.id,
      name: att.name,
      filename: att.filename || att.name,
      size: att.size,
      type: att.type,
      contentType: att.contentType || att.type,
      encoding: att.encoding || (att.content ? 'base64' : undefined),
      content: att.content || null
    }))
  });

  const handleSaveDraft = () => {
    if (isSavingDraft) return;
    const payload = buildDraftPayload();
    if (!payload.bodyHtml || payload.bodyHtml.trim() === '') {
      toast.error('Email body is required before saving a draft');
      return;
    }

    if (activeDraftId) {
      updateTemplateDraftMutation.mutate({ id: activeDraftId, data: payload });
    } else {
      createTemplateDraftMutation.mutate(payload);
    }
  };

  const handleEditDraft = (draft) => {
    if (!draft) return;
    setActiveDraftId(draft.id);
    const isInitial =
      draft.stage === 'abstract_submission' &&
      (draft.followUpNumber === 0 || draft.followUpNumber === 1);
    const uiStage = isInitial ? 'initial' : (draft.stage || '');
    setFormData({
      name: draft.name || '',
      stage: uiStage,
      subject: draft.subject || '',
      bodyHtml: draft.bodyHtml || '',
      bodyText: draft.bodyText || '',
      description: draft.description || '',
      variables: draft.variables || [],
      sendAfterDays: draft.sendAfterDays || 1,
      followUpNumber: draft.followUpNumber || 1
    });
    setAttachments(
      (draft.attachments || []).map((att, idx) => ({
        ...att,
        id: att.id || `${draft.id}-${idx}`,
        filename: att.filename || att.name,
        contentType: att.contentType || att.type,
        encoding: att.encoding || (att.content ? 'base64' : att.encoding)
      }))
    );
    setShowAddModal(true);
  };

  const handleDeleteDraft = (id) => {
    if (!id) return;
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm('Delete this template draft permanently?');
      if (!confirmed) return;
    }
    const closeOnSuccess = activeDraftId === id;
    deleteTemplateDraftMutation.mutate({ id, closeOnSuccess });
  };

  const insertVariable = (variable) => {
    const notation = `{${variable}}`;
    const quillInstance = bodyEditorRef.current?.getEditor?.();

    if (quillInstance) {
      const selection = quillInstance.getSelection(true);
      let index = quillInstance.getLength();

      if (selection) {
        index = selection.index;
        if (selection.length > 0) {
          quillInstance.deleteText(selection.index, selection.length, 'user');
        }
      }

      quillInstance.insertText(index, notation, 'user');
      quillInstance.setSelection(index + notation.length, 0, 'user');
      quillInstance.focus();
      return;
    }

    // Fallback: update state directly
    setFormData(prev => {
      const updatedHtml = `${prev.bodyHtml || ''}${notation}`;
      return {
        ...prev,
        bodyHtml: updatedHtml,
        bodyText: stripHtml(updatedHtml)
      };
    });
  };

  const resetForm = () => {
    setFormData(getInitialTemplateForm());
    setAttachments([]);
    setActiveDraftId(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name?.trim()) {
      toast.error('Template name is required');
      return;
    }
    if (!formData.stage) {
      toast.error('Please select a stage');
      return;
    }
    if (!formData.subject?.trim()) {
      toast.error('Subject is required');
      return;
    }
    const bodyTextValue = stripHtml(formData.bodyHtml);
    if (!bodyTextValue) {
      toast.error('Email body is required');
      return;
    }
    const templateData = {
      ...formData,
      // Map virtual "initial" stage to backend stage + ensure followUpNumber = 1
      stage: formData.stage === 'initial' ? 'abstract_submission' : formData.stage,
      followUpNumber: formData.stage === 'initial' ? 1 : (formData.followUpNumber || 1),
      bodyText: bodyTextValue,
      attachments: attachments.map(att => ({
        id: att.id,
        name: att.name,
        filename: att.filename || att.name,
        size: att.size,
        type: att.type,
        contentType: att.contentType || att.type,
        encoding: att.encoding || (att.content ? 'base64' : undefined),
        content: att.content || null
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
    setActiveDraftId(null);
    setActiveTab('templates');
    resetForm();
  };

  const handleCloseModalWithAutoSave = () => {
    // Check if there's any meaningful content to save
    const hasContent = 
      formData.name?.trim() || 
      formData.subject?.trim() || 
      formData.bodyHtml?.trim() || 
      attachments.length > 0;

    // If there's content and we're in add mode (not editing an existing template)
    if (hasContent && showAddModal && !selectedTemplate) {
      const bodyTextValue = stripHtml(formData.bodyHtml || '');
      
      // Only auto-save if there's body content (required for draft)
      if (bodyTextValue.trim()) {
        const payload = buildDraftPayload();
        
        if (activeDraftId) {
          // Update existing draft silently
          updateTemplateDraftMutation.mutate(
            { id: activeDraftId, data: payload },
            {
              onSuccess: () => {
                toast.success('Draft auto-saved');
                handleCloseModal();
              },
              onError: (error) => {
                console.error('Error auto-saving draft:', error);
                // Close modal even if save fails
                handleCloseModal();
              }
            }
          );
          return; // Don't close immediately, wait for mutation
        } else {
          // Create new draft silently
          createTemplateDraftMutation.mutate(
            payload,
            {
              onSuccess: () => {
                toast.success('Draft auto-saved');
                handleCloseModal();
              },
              onError: (error) => {
                console.error('Error auto-saving draft:', error);
                // Close modal even if save fails
                handleCloseModal();
              }
            }
          );
          return; // Don't close immediately, wait for mutation
        }
      }
    }
    
    // Close the modal if no content to save
    handleCloseModal();
  };

  const handlePreview = (template) => {
    setSelectedTemplate(template);
    setShowPreviewModal(true);
  };

  const renderPreview = (template) => {
    // Sample data for preview rendering
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
      conferenceShortName: 'TC24',
      conferenceVenue: 'Convention Center, New York',
      conferenceDate: 'December 15, 2024 to December 17, 2024',
      conferenceStartDate: 'December 15, 2024',
      conferenceEndDate: 'December 17, 2024',
      abstractDeadline: 'November 30, 2024',
      registrationDeadline: 'December 1, 2024',
      conferenceWebsite: 'https://techconf2024.com',
      conferenceAbstractSubmissionLink: 'https://techconf2024.com/abstracts',
      conferenceRegistrationLink: 'https://techconf2024.com/register',
      'conference.abstractSubmissionLink': 'https://techconf2024.com/abstracts',
      'conference.registrationLink': 'https://techconf2024.com/register',
      conference_abstract_submission_link: 'https://techconf2024.com/abstracts',
      conference_registration_link: 'https://techconf2024.com/register',
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
      <style>{TEMPLATE_EDITOR_STYLES}</style>
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
            onClick={() => {
              resetForm();
              setActiveTab('templates');
              setShowAddModal(true);
            }}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 font-medium shadow-sm flex items-center"
          >
            <Plus className="h-5 w-5 mr-2" />
            Create Template
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1">
          <button
            type="button"
            onClick={() => setActiveTab('templates')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'templates'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            Templates
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('drafts')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'drafts'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            Drafts
          </button>
        </div>
        {activeTab === 'drafts' && (
          <p className="text-xs text-gray-500">
            Drafts are private to you until published.
          </p>
        )}
      </div>

      {/* Templates / Drafts Grid */}
      {activeTab === 'templates' ? (
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
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {draftsLoading ? (
            <div className="col-span-full flex justify-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
          ) : templateDrafts.length === 0 ? (
            <div className="col-span-full text-center py-8">
              <File className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No drafts saved yet</p>
              <p className="text-sm text-gray-400 mt-1">Use “Save Draft” in the composer to keep work-in-progress templates.</p>
            </div>
          ) : (
            templateDrafts.map((draft) => (
              <div key={draft.id} className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-lg transition-all duration-200 p-6">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">{draft.name || 'Untitled Draft'}</h3>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>{draft.stage ? getStageName(draft.stage) : 'Stage not set'}</span>
                      <span>•</span>
                      <span>Updated {draft.updatedAt ? new Date(draft.updatedAt).toLocaleString() : 'recently'}</span>
                    </div>
                  </div>
                  <span className="text-xs uppercase tracking-wide text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                    Draft
                  </span>
                </div>
                <div className="space-y-3 mb-4">
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-1">Subject:</p>
                    <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded border-l-2 border-blue-200">
                      {draft.subject || '(no subject)'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-1">Preview:</p>
                    <p className="text-sm text-gray-500 bg-gray-50 p-2 rounded line-clamp-3">
                      {draft.bodyText?.substring(0, 120) || draft.bodyHtml?.replace(/<[^>]*>/g, '').substring(0, 120) || 'No content yet'}
                    </p>
                  </div>
                </div>
                <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    {draft.attachments?.length ? (
                      <span className="flex items-center">
                        <Paperclip className="h-3 w-3 mr-1" />
                        {draft.attachments.length} files
                      </span>
                    ) : (
                      <span>No attachments</span>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleEditDraft(draft)}
                      className="px-3 py-1.5 text-sm text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                    >
                      Edit Draft
                    </button>
                    <button
                      onClick={() => handleDeleteDraft(draft.id)}
                      className="px-3 py-1.5 text-sm text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                      disabled={isDeletingDraft && draftIdBeingDeleted === draft.id}
                    >
                      {isDeletingDraft && draftIdBeingDeleted === draft.id ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Add Template Modal */}
      <Transition appear show={showAddModal} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={handleCloseModalWithAutoSave}>
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
                          {activeDraftId ? 'Edit Template Draft' : 'Create New Template'}
                        </Dialog.Title>
                        <p className="text-sm text-gray-600 mt-1">
                          {activeDraftId
                            ? 'Update your draft and publish when it is ready.'
                            : 'Create dynamic email templates with attachments and variables'}
                        </p>
                      </div>
                      <button
                        onClick={handleCloseModalWithAutoSave}
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
                              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white"
                            >
                              <option value="">Select Stage</option>
                              <option value="initial">Initial Email</option>
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
                            <div className="border border-gray-300 rounded-lg bg-white overflow-hidden">
                              <ReactQuill
                                ref={bodyEditorRef}
                                value={formData.bodyHtml}
                                onChange={handleBodyChange}
                                modules={quillModules}
                                formats={quillFormats}
                                placeholder="Use {name}, {conferenceName}, {email}, {country} for variables"
                                className="template-editor"
                              />
                            </div>
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
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-6 border-t border-gray-200">
                        {activeDraftId && (
                          <button
                            type="button"
                            onClick={() => handleDeleteDraft(activeDraftId)}
                            disabled={isDeletingDraft && draftIdBeingDeleted === activeDraftId}
                            className="inline-flex items-center justify-center px-4 py-2 text-sm text-red-600 bg-red-50 hover:bg-red-100 border border-red-100 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {isDeletingDraft && draftIdBeingDeleted === activeDraftId ? 'Deleting Draft…' : 'Delete Draft'}
                          </button>
                        )}
                        <div className="flex items-center justify-end gap-3 sm:ml-auto">
                          <button
                            type="button"
                            onClick={handleCloseModalWithAutoSave}
                            className="px-6 py-3 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-all duration-200 font-medium"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveDraft}
                            disabled={isSavingDraft}
                            className="px-6 py-3 text-blue-600 bg-blue-50 border border-blue-100 rounded-lg hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {isSavingDraft ? 'Saving…' : activeDraftId ? 'Update Draft' : 'Save Draft'}
                          </button>
                          <button
                            type="submit"
                            disabled={addTemplateMutation.isLoading}
                            className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium shadow-sm"
                          >
                            {addTemplateMutation.isLoading ? 'Creating...' : 'Create Template'}
                          </button>
                        </div>
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
                  
                  {selectedTemplate ? (
                    <TemplateForm
                      template={selectedTemplate}
                      onSubmit={(data) => updateTemplateMutation.mutate({ id: selectedTemplate.id, data })}
                      onCancel={() => {
                        setShowEditModal(false);
                        setSelectedTemplate(null);
                      }}
                      loading={updateTemplateMutation.isLoading}
                    />
                  ) : (
                    <div className="flex items-center justify-center py-8 text-sm text-gray-500">
                      Select a template to edit.
                    </div>
                  )}
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

const estimateSizeFromBase64 = (content) => {
  if (!content || typeof content !== 'string') return 0;
  const padding = (content.match(/=*$/) || [''])[0].length;
  return Math.ceil(content.length / 4) * 3 - padding;
};

const normalizeExistingAttachments = (template) => {
  if (!template?.attachments || !Array.isArray(template.attachments)) {
    return [];
  }

  return template.attachments.map((att, idx) => {
    const content = typeof att.content === 'string' ? att.content : '';
    return {
      ...att,
      id: att.id || `${template.id || 'template'}-attachment-${idx}`,
      name: att.name || att.filename || `Attachment ${idx + 1}`,
      filename: att.filename || att.name || `attachment-${idx + 1}`,
      content,
      type: att.type || att.contentType || 'application/octet-stream',
      contentType: att.contentType || att.type || 'application/octet-stream',
      encoding: att.encoding || (content ? 'base64' : undefined),
      size: typeof att.size === 'number' ? att.size : estimateSizeFromBase64(content)
    };
  });
};

const formatBytes = (bytes) => {
  if (!bytes || Number.isNaN(bytes)) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const TemplateForm = ({ template, onSubmit, onCancel, loading }) => {
  const editorRef = useRef(null);
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    name: template?.name || '',
    stage: template?.stage || '',
    subject: template?.subject || '',
    bodyHtml: template?.bodyHtml || '',
    bodyText: template?.bodyText || stripHtml(template?.bodyHtml || '')
  });
  const [attachments, setAttachments] = useState(normalizeExistingAttachments(template));

  useEffect(() => {
    setFormData({
      name: template?.name || '',
      stage: template?.stage || '',
      subject: template?.subject || '',
      bodyHtml: template?.bodyHtml || '',
      bodyText: template?.bodyText || stripHtml(template?.bodyHtml || '')
    });
    setAttachments(normalizeExistingAttachments(template));
  }, [template]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const bodyTextValue = stripHtml(formData.bodyHtml);
    if (!bodyTextValue) {
      toast.error('Email body is required');
      return;
    }

    const attachmentPayload = attachments.map(att => ({
      id: att.id,
      name: att.name,
      filename: att.filename || att.name,
      size: att.size,
      type: att.type,
      contentType: att.contentType || att.type,
      encoding: att.encoding || (att.content ? 'base64' : undefined),
      content: att.content || null
    }));

    onSubmit({
      ...formData,
      bodyText: bodyTextValue,
      attachments: attachmentPayload
    });
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleBodyChange = (value) => {
    setFormData({
      ...formData,
      bodyHtml: value,
      bodyText: stripHtml(value)
    });
  };

  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    try {
      const processed = await Promise.all(
        files.map(async (file) => {
          const base64Content = await readFileAsBase64(file);
          return {
            id: `${Date.now()}-${Math.random()}`,
            name: file.name,
            filename: file.name,
            size: file.size,
            type: file.type || 'application/octet-stream',
            contentType: file.type || 'application/octet-stream',
            encoding: 'base64',
            content: base64Content
          };
        })
      );

      setAttachments((prev) => [...prev, ...processed]);
    } catch (error) {
      console.error('Error reading attachment:', error);
      toast.error('Failed to read one or more attachments');
    } finally {
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const removeAttachment = (id) => {
    setAttachments((prev) => prev.filter((att) => att.id !== id));
  };

  const handleDownloadAttachment = (attachment) => {
    if (typeof window === 'undefined') {
      toast.error('Download is only available in the browser');
      return;
    }

    if (!attachment?.content) {
      toast.error('Attachment content is unavailable');
      return;
    }

    try {
      const byteCharacters = window.atob(attachment.content);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i += 1) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: attachment.contentType || 'application/octet-stream' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = attachment.filename || attachment.name || 'attachment';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download attachment:', error);
      toast.error('Unable to download attachment');
    }
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
            <option value="initial">Initial Email</option>
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
          Email Body (HTML) *
        </label>
        <div className="border border-gray-300 rounded-lg bg-white overflow-hidden">
          <ReactQuill
            ref={editorRef}
            value={formData.bodyHtml}
            onChange={handleBodyChange}
            modules={quillModules}
            formats={quillFormats}
            placeholder="Use {Name}, {ConferenceName}, {Email}, {Country} for variables"
            className="template-editor"
          />
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Available variables: {'{Name}'}, {'{ConferenceName}'}, {'{Email}'}, {'{Country}'}
        </p>
      </div>

      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-gray-900 mb-4">File Attachments</h4>
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors duration-200">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileUpload}
            className="hidden"
            id="edit-file-upload"
          />
          <label htmlFor="edit-file-upload" className="cursor-pointer">
            <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-600">Click to upload files or drag and drop</p>
            <p className="text-xs text-gray-500">PDF, DOC, DOCX, PNG, JPG up to 10MB each</p>
          </label>
        </div>

        {attachments.length > 0 && (
          <div className="space-y-2 mt-4">
            <h5 className="text-sm font-medium text-gray-700">Attached Files:</h5>
            {attachments.map((attachment) => (
              <div key={attachment.id} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg">
                <div className="flex items-center">
                  <Paperclip className="h-4 w-4 text-gray-400 mr-2" />
                  <div>
                    <p className="text-sm text-gray-700">{attachment.filename || attachment.name}</p>
                    <p className="text-xs text-gray-500">{formatBytes(attachment.size)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleDownloadAttachment(attachment)}
                    className="p-1.5 text-blue-500 hover:text-blue-700 rounded-full hover:bg-blue-50"
                    title="Download attachment"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeAttachment(attachment.id)}
                    className="p-1.5 text-red-500 hover:text-red-700 rounded-full hover:bg-red-50"
                    title="Remove attachment"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
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
