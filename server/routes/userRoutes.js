const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, Conference, Client } = require('../models');
const { Op } = require('sequelize');

// JWT Secret from environment or default
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Middleware to check authentication
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access denied' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      console.error('JWT verification error:', err.message);
      return res.status(403).json({ error: 'Invalid token', details: err.message });
    }
    req.user = user;
    next();
  });
};

// GET /api/users - Get all users
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { role, search, page = 1, limit = 50 } = req.query;
    
    let whereClause = {};
    
    // Filter by role if provided
    if (role && role !== 'all') {
      whereClause.role = role;
    }
    
    // Search functionality
    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } }
      ];
    }
    
    // Role-based access control
    if (req.user.role === 'TeamLead') {
      // Team leads can only see their subordinates
      whereClause.managerId = req.user.id;
    } else if (req.user.role === 'Member') {
      // Members can only see themselves
      whereClause.id = req.user.id;
    }
    
    const { count, rows: users } = await User.findAndCountAll({
      where: whereClause,
      attributes: ['id', 'name', 'email', 'role', 'phone', 'department', 'position', 'isActive', 'createdAt', 'updatedAt'],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit)
    });
    
    res.json({
      users,
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / limit)
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// GET /api/users/:id - Get user by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await User.findByPk(id, {
      attributes: ['id', 'name', 'email', 'role', 'phone', 'department', 'jobTitle', 'isActive', 'createdAt', 'updatedAt']
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Access control
    if (req.user.role !== 'CEO' && req.user.id !== id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// POST /api/users - Create new user
router.post('/', authenticateToken, async (req, res) => {
  try {
    // Only CEO can create users
    if (req.user.role !== 'CEO' && req.user.role !== 'TeamLead') {
      return res.status(403).json({ error: 'Only CEO and Team Leads can create users' });
    }
    
    const { name, email, password, role, phone, department, jobTitle, position, managerId } = req.body;
    
    // Validate required fields
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'Name, email, password, and role are required' });
    }
    
    // Check if user already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create user without organizationId to avoid foreign key constraint
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role,
      phone,
      department,
      position: position || jobTitle, // Handle both field names
      managerId: managerId || req.user.id,
      organizationId: null, // Set to null to avoid foreign key constraint
      isActive: true
    });
    
    // Return user without password
    const userResponse = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      department: user.department,
      position: user.position, // Use position instead of jobTitle
      isActive: user.isActive,
      createdAt: user.createdAt
    };
    
    res.status(201).json({
      message: 'User created successfully',
      user: userResponse
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// PUT /api/users/:id - Update user
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role, phone, department, jobTitle, isActive } = req.body;
    
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Access control
    if (req.user.role !== 'CEO' && req.user.id !== id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Update user
    await user.update({
      name: name || user.name,
      email: email || user.email,
      role: role || user.role,
      phone: phone || user.phone,
      department: department || user.department,
      jobTitle: jobTitle || user.jobTitle,
      isActive: isActive !== undefined ? isActive : user.isActive
    });
    
    // Return user without password
    const userResponse = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      department: user.department,
      jobTitle: user.jobTitle,
      isActive: user.isActive,
      updatedAt: user.updatedAt
    };
    
    res.json({
      message: 'User updated successfully',
      user: userResponse
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// DELETE /api/users/:id - Delete user
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    // Only CEO can delete users
    if (req.user.role !== 'CEO') {
      return res.status(403).json({ error: 'Only CEO can delete users' });
    }
    
    const { id } = req.params;
    
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Prevent deleting CEO
    if (user.role === 'CEO') {
      return res.status(400).json({ error: 'Cannot delete CEO user' });
    }
    
    await user.destroy();
    
    res.json({
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// GET /api/users/stats/overview - Get user statistics
router.get('/stats/overview', authenticateToken, async (req, res) => {
  try {
    const totalUsers = await User.count();
    const ceoCount = await User.count({ where: { role: 'CEO' } });
    const teamLeadCount = await User.count({ where: { role: 'TeamLead' } });
    const memberCount = await User.count({ where: { role: 'Member' } });
    const activeUsers = await User.count({ where: { isActive: true } });
    
    res.json({
      totalUsers,
      ceoCount,
      teamLeadCount,
      memberCount,
      activeUsers,
      inactiveUsers: totalUsers - activeUsers
    });
  } catch (error) {
    console.error('Error fetching user statistics:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

module.exports = router;

