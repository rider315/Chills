const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const config = require('./config');
const { connectDB } = require('./db');

const app = express();

// ---------------------------------------------------------------------------
// Ensure required directories exist
// ---------------------------------------------------------------------------
if (!fs.existsSync(config.uploadsDir)) {
  fs.mkdirSync(config.uploadsDir, { recursive: true });
  console.log(`Created directory: ${config.uploadsDir}`);
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(
  cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ---------------------------------------------------------------------------
// Request logging (lightweight)
// ---------------------------------------------------------------------------
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.originalUrl} → ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
const resumeRoutes = require('./routes/resume');
const recruiterRoutes = require('./routes/recruiters');
const emailRoutes = require('./routes/emails');
const applicationRoutes = require('./routes/applications');
const replyRoutes = require('./routes/replies');
const settingsRoutes = require('./routes/settings');

app.use('/api/resume', resumeRoutes);
app.use('/api/recruiters', recruiterRoutes);
app.use('/api/emails', emailRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/replies', replyRoutes);
app.use('/api/settings', settingsRoutes);

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ---------------------------------------------------------------------------
// 404 handler
// ---------------------------------------------------------------------------
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
});

// ---------------------------------------------------------------------------
// Global error handler
// ---------------------------------------------------------------------------
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err);

  // Handle multer errors
  if (err.name === 'MulterError') {
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  }

  // Handle multer custom errors (e.g., file filter)
  if (err.message && err.message.includes('Only')) {
    return res.status(400).json({ error: err.message });
  }

  return res.status(500).json({ error: err.message || 'Internal server error' });
});

// ---------------------------------------------------------------------------
// Start server (connect to MongoDB first)
// ---------------------------------------------------------------------------
const PORT = config.port;

async function start() {
  await connectDB();

  app.listen(PORT, () => {
    console.log('');
    console.log('  ❄️  Chills Backend Server');
    console.log(`  ➜  Local:   http://localhost:${PORT}`);
    console.log(`  ➜  API:     http://localhost:${PORT}/api`);
    console.log(`  ➜  Health:  http://localhost:${PORT}/api/health`);
    console.log(`  ➜  Uploads: ${config.uploadsDir}`);
    console.log('');
  });
}

start();

module.exports = app;
