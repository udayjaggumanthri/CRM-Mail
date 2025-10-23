const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 3002;

app.use(cors());
app.use(express.json());

// Simple test endpoint
app.get('/api/test', (req, res) => {
  res.json({ message: 'Server is working!' });
});

// Simple login test
app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (email === 'admin@crm.com' && password === 'admin123') {
      const token = jwt.sign(
        { id: '1', email: 'admin@crm.com', role: 'CEO' },
        'your-secret-key',
        { expiresIn: '24h' }
      );
      
      res.json({
        token,
        user: { id: '1', email: 'admin@crm.com', role: 'CEO' }
      });
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Test server running on port ${PORT}`);
});
