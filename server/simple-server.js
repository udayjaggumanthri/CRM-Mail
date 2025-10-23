const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Simple email API endpoint
app.get('/api/emails', (req, res) => {
  console.log('Email API called');
  res.json([]);
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 Simple server running on port ${PORT}`);
  console.log('✅ Server started successfully');
});

// Keep server running
console.log('Server is running and waiting for requests...');

process.on('SIGINT', () => {
  console.log('\nShutting down simple server...');
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\nShutting down simple server...');
  server.close(() => {
    process.exit(0);
  });
});
