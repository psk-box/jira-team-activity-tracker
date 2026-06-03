'use strict';

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { logger } = require('./services/logger');
const jiraRoutes = require('./routes/jira');
const configRoutes = require('./routes/config');
const gitlabRoutes = require('./routes/gitlab');
const { errorHandler } = require('./middleware/errorHandler');
const { requestLogger } = require('./middleware/requestLogger');

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  })
);
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

// Request logging
app.use(requestLogger);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/jira', jiraRoutes);
app.use('/api/config', configRoutes);
app.use('/api/gitlab', gitlabRoutes);

// Error handler (must be last)
app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`🚀 Jira Tracker backend running on port ${PORT}`);
});

module.exports = app;
