import React, { useState, useEffect } from 'react';
import { 
  UserPlusIcon,
  PencilSquareIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  UserCircleIcon,
  ShieldCheckIcon,
  UsersIcon,
  EnvelopeIcon,
  PhoneIcon,
  BuildingOfficeIcon,
  CheckCircleIcon,
  XCircleIcon,
  ChevronDownIcon,
  KeyIcon,
  LockClosedIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Eye, EyeOff } from 'lucide-react';

const EnhancedUserManagement = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordStep, setPasswordStep] = useState('change'); // 'change' or 'reset'
  const [currentPasswordError, setCurrentPasswordError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'Member',
    phone: '',
    department: '',
    jobTitle: ''
  });
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, [filterRole]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/users', {
        params: { role: filterRole }
      });
      setUsers(response.data.users || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingUser) {
        await axios.put(`/api/users/${editingUser.id}`, formData);
        toast.success('User updated successfully');
      } else {
        await axios.post('/api/users', formData);
        toast.success('User created successfully');
      }
      await fetchUsers();
      handleCloseModal();
    } catch (error) {
      console.error('Error saving user:', error);
      toast.error(error.response?.data?.error || 'Error saving user');
    }
  };

  const handleDelete = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    
    try {
      await axios.delete(`/api/users/${userId}`);
      toast.success('User deleted successfully');
      await fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error(error.response?.data?.error || 'Error deleting user');
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingUser(null);
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'Member',
      phone: '',
      department: '',
      jobTitle: ''
    });
    setShowPassword(false);
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setFormData({
      name: user.name || '',
      email: user.email || '',
      password: '',
      role: user.role || 'Member',
      phone: user.phone || '',
      department: user.department || '',
      jobTitle: user.jobTitle || ''
    });
    setShowPassword(false);
    setShowModal(true);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePasswordManagement = (user) => {
    setSelectedUser(user);
    setPasswordData({
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
    setPasswordStep('change');
    setCurrentPasswordError('');
    setShowPasswordModal(true);
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }

    try {
      if (passwordStep === 'change') {
        // Try to change password with current password
        await axios.put(`/api/users/${selectedUser.id}/change-password`, {
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword
        });
        toast.success('Password changed successfully');
        handleClosePasswordModal();
      } else {
        // Reset password without current password (CEO only)
        await axios.put(`/api/users/${selectedUser.id}/reset-password`, {
          newPassword: passwordData.newPassword
        });
        toast.success('Password reset successfully');
        handleClosePasswordModal();
      }
    } catch (error) {
      console.error('Error with password operation:', error);
      
      if (passwordStep === 'change' && error.response?.status === 400) {
        // Current password is incorrect, offer reset option
        setCurrentPasswordError('Current password is incorrect');
        toast.error('Current password is incorrect. Would you like to reset the password instead?');
      } else {
        toast.error(error.response?.data?.error || 'Failed to update password');
      }
    }
  };

  const handleSwitchToReset = () => {
    setPasswordStep('reset');
    setCurrentPasswordError('');
    setPasswordData(prev => ({
      ...prev,
      currentPassword: ''
    }));
  };

  const handleClosePasswordModal = () => {
    setShowPasswordModal(false);
    setSelectedUser(null);
    setPasswordData({
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
    setPasswordStep('change');
    setCurrentPasswordError('');
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case 'CEO':
        return <ShieldCheckIcon className="w-5 h-5 text-purple-600" />;
      case 'TeamLead':
        return <UsersIcon className="w-5 h-5 text-blue-600" />;
      case 'Member':
        return <UserCircleIcon className="w-5 h-5 text-green-600" />;
      default:
        return <UserCircleIcon className="w-5 h-5 text-gray-600" />;
    }
  };

  const getRoleBadge = (role) => {
    const badges = {
      CEO: 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white',
      TeamLead: 'bg-gradient-to-r from-blue-500 to-cyan-600 text-white',
      Member: 'bg-gradient-to-r from-green-500 to-emerald-600 text-white'
    };
    return badges[role] || 'bg-gray-100 text-gray-800';
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
            <UsersIcon className="w-6 h-6 text-blue-600" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
                User Management
              </h1>
              <p className="text-gray-600 flex items-center">
                <UsersIcon className="w-5 h-5 mr-2" />
                Manage your team members and their roles
              </p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="group relative px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center space-x-2"
            >
              <UserPlusIcon className="w-5 h-5" />
              <span className="font-semibold">Add User</span>
              <div className="absolute inset-0 rounded-xl bg-white opacity-0 group-hover:opacity-20 transition-opacity"></div>
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-medium">Total Users</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{users.length}</p>
              </div>
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                <UsersIcon className="w-7 h-7 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-medium">Team Leads</p>
                <p className="text-3xl font-bold text-blue-600 mt-1">
                  {users.filter(u => u.role === 'TeamLead').length}
                </p>
              </div>
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl flex items-center justify-center">
                <ShieldCheckIcon className="w-7 h-7 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-medium">Members</p>
                <p className="text-3xl font-bold text-green-600 mt-1">
                  {users.filter(u => u.role === 'Member').length}
                </p>
              </div>
              <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
                <UserCircleIcon className="w-7 h-7 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-medium">Active</p>
                <p className="text-3xl font-bold text-purple-600 mt-1">
                  {users.filter(u => u.isActive).length}
                </p>
              </div>
              <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center">
                <CheckCircleIcon className="w-7 h-7 text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6 border border-gray-100">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <MagnifyingGlassIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              />
            </div>
            <div className="md:w-64 relative">
              <FunnelIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="w-full pl-12 pr-10 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 appearance-none bg-white cursor-pointer"
              >
                <option value="all">All Roles</option>
                <option value="CEO">CEO</option>
                <option value="TeamLead">Team Lead</option>
                <option value="Member">Member</option>
              </select>
              <ChevronDownIcon className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Users Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredUsers.map((user) => (
            <div
              key={user.id}
              className="bg-white rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden border border-gray-100 group"
            >
              {/* Card Header */}
              <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-6 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full -mr-16 -mt-16"></div>
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white opacity-10 rounded-full -ml-12 -mb-12"></div>
                <div className="relative flex items-center">
                  <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-2xl font-bold text-blue-600 shadow-lg">
                    {user.name?.charAt(0) || 'U'}
                  </div>
                  <div className="ml-4 flex-1">
                    <h3 className="text-xl font-bold">{user.name || 'No Name'}</h3>
                    <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold mt-1 ${getRoleBadge(user.role)}`}>
                      <span className="mr-1">{getRoleIcon(user.role)}</span>
                      {user.role}
                    </div>
                  </div>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-6">
                <div className="space-y-3">
                  <div className="flex items-center text-gray-600">
                    <EnvelopeIcon className="w-5 h-5 mr-3 text-blue-500" />
                    <span className="text-sm truncate">{user.email}</span>
                  </div>
                  {user.phone && (
                    <div className="flex items-center text-gray-600">
                      <PhoneIcon className="w-5 h-5 mr-3 text-green-500" />
                      <span className="text-sm">{user.phone}</span>
                    </div>
                  )}
                  {user.department && (
                    <div className="flex items-center text-gray-600">
                      <BuildingOfficeIcon className="w-5 h-5 mr-3 text-purple-500" />
                      <span className="text-sm">{user.department}</span>
                    </div>
                  )}
                  {user.jobTitle && (
                    <div className="flex items-center text-gray-600">
                      <UserCircleIcon className="w-5 h-5 mr-3 text-orange-500" />
                      <span className="text-sm">{user.jobTitle}</span>
                    </div>
                  )}
                </div>

                {/* Status Badge */}
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                      user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {user.isActive ? (
                        <>
                          <CheckCircleIcon className="w-4 h-4 mr-1" />
                          Active
                        </>
                      ) : (
                        <>
                          <XCircleIcon className="w-4 h-4 mr-1" />
                          Inactive
                        </>
                      )}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card Actions */}
              <div className="px-6 pb-6">
                {/* Primary Actions Row */}
                <div className="flex space-x-2 mb-2">
                <button
                  onClick={() => handleEdit(user)}
                  className="flex-1 flex items-center justify-center px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors duration-200 font-medium"
                >
                  <PencilSquareIcon className="w-4 h-4 mr-2" />
                  Edit
                </button>
                {user.role !== 'CEO' && (
                  <button
                    onClick={() => handleDelete(user.id)}
                    className="flex items-center justify-center px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors duration-200 font-medium"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                )}
                </div>
                
                {/* Password Management Row */}
                <div className="flex space-x-2">
                  <button
                    onClick={() => handlePasswordManagement(user)}
                    className="flex-1 flex items-center justify-center px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors duration-200 font-medium"
                  >
                    <KeyIcon className="w-4 h-4 mr-2" />
                    Manage Password
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredUsers.length === 0 && (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <UsersIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No users found</h3>
            <p className="text-gray-600">
              {searchTerm ? 'Try adjusting your search criteria' : 'Get started by adding your first user'}
            </p>
          </div>
        )}
      </div>

      {/* Add/Edit User Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl transform transition-all">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 rounded-t-2xl">
              <div className="flex items-center justify-between text-white">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-white bg-opacity-20 rounded-xl flex items-center justify-center mr-4">
                    <UserPlusIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold">
                      {editingUser ? 'Edit User' : 'Add New User'}
                    </h3>
                    <p className="text-blue-100 text-sm">
                      {editingUser ? 'Update user information' : 'Create a new team member'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleCloseModal}
                  className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition-colors"
                >
                  <XCircleIcon className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    placeholder="John Doe"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    placeholder="john@example.com"
                  />
                </div>

                {!editingUser && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Password *
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        name="password"
                        value={formData.password}
                        onChange={handleInputChange}
                        required={!editingUser}
                        className="w-full px-4 py-3 pr-12 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute inset-y-0 right-3 flex items-center text-gray-500 hover:text-gray-700 focus:outline-none"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Role *
                  </label>
                  <select
                    name="role"
                    value={formData.role}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 appearance-none bg-white cursor-pointer"
                  >
                    {/* TeamLead can only create Member users */}
                    <option value="Member">Member</option>
                    {user?.role === 'CEO' && <option value="TeamLead">Team Lead</option>}
                    {user?.role === 'CEO' && <option value="CEO">CEO</option>}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    placeholder="+1 (555) 000-0000"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Department
                  </label>
                  <input
                    type="text"
                    name="department"
                    value={formData.department}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    placeholder="Sales"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Job Title
                  </label>
                  <input
                    type="text"
                    name="jobTitle"
                    value={formData.jobTitle}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    placeholder="Sales Manager"
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex justify-end space-x-3 mt-8 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-6 py-3 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 font-semibold transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 font-semibold transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  {editingUser ? 'Update User' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Unified Password Management Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">
                  {passwordStep === 'change' ? 'Change Password' : 'Reset Password'}
                </h2>
                <button
                  onClick={handleClosePasswordModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircleIcon className="w-6 h-6" />
                </button>
              </div>

              <div className={`mb-4 p-3 rounded-lg ${passwordStep === 'change' ? 'bg-blue-50' : 'bg-orange-50'}`}>
                <p className={`text-sm ${passwordStep === 'change' ? 'text-blue-800' : 'text-orange-800'}`}>
                  <strong>User:</strong> {selectedUser?.name} ({selectedUser?.email})
                </p>
              </div>

              {passwordStep === 'reset' && (
                <div className="mb-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                  <div className="flex items-start">
                    <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600 mt-0.5 mr-3" />
                    <div>
                      <p className="text-sm text-yellow-800 font-medium">Password Reset</p>
                      <p className="text-sm text-yellow-700 mt-1">
                        This will set a new password for the user. They will need to use this new password to log in.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <form onSubmit={handlePasswordSubmit}>
                <div className="space-y-4">
                  {passwordStep === 'change' && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Current Password
                      </label>
                      <input
                        type="password"
                        value={passwordData.currentPassword}
                        onChange={(e) => setPasswordData(prev => ({
                          ...prev,
                          currentPassword: e.target.value
                        }))}
                        className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:border-transparent transition-all duration-200 ${
                          currentPasswordError 
                            ? 'border-red-300 focus:ring-red-500' 
                            : 'border-gray-200 focus:ring-green-500'
                        }`}
                        placeholder="Enter current password"
                        required
                      />
                      {currentPasswordError && (
                        <p className="text-red-500 text-sm mt-1">{currentPasswordError}</p>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      New Password
                    </label>
                    <input
                      type="password"
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData(prev => ({
                        ...prev,
                        newPassword: e.target.value
                      }))}
                      className={`w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:border-transparent transition-all duration-200 ${
                        passwordStep === 'change' ? 'focus:ring-green-500' : 'focus:ring-orange-500'
                      }`}
                      placeholder="Enter new password"
                      required
                      minLength={6}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData(prev => ({
                        ...prev,
                        confirmPassword: e.target.value
                      }))}
                      className={`w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:border-transparent transition-all duration-200 ${
                        passwordStep === 'change' ? 'focus:ring-green-500' : 'focus:ring-orange-500'
                      }`}
                      placeholder="Confirm new password"
                      required
                      minLength={6}
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-200">
                  {passwordStep === 'change' && currentPasswordError && (
                    <button
                      type="button"
                      onClick={handleSwitchToReset}
                      className="px-4 py-2 text-orange-600 bg-orange-50 rounded-lg hover:bg-orange-100 font-medium transition-colors duration-200"
                    >
                      Reset Instead
                    </button>
                  )}
                  
                  <div className="flex space-x-3 ml-auto">
                    <button
                      type="button"
                      onClick={handleClosePasswordModal}
                      className="px-6 py-3 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 font-semibold transition-colors duration-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className={`px-6 py-3 text-white rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl ${
                        passwordStep === 'change' 
                          ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700'
                          : 'bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700'
                      }`}
                    >
                      {passwordStep === 'change' ? 'Change Password' : 'Reset Password'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedUserManagement;

