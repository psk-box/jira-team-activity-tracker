'use strict';

const { logger } = require('../services/logger');

function errorHandler(err, req, res, _next) {
  logger.error('Unhandled error', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
  });

  // Zod-like validation errors (check for .errors array)
  if (err.errors && Array.isArray(err.errors) && err.name === 'ZodError') {
    res.status(400).json({
      error: 'Validation error',
      details: err.errors,
    });
    return;
  }

  // Jira / GitLab API errors (axios)
  if (err.response) {
    const status = err.response.status;
    const message =
      (err.response.data && err.response.data.errorMessages && err.response.data.errorMessages.join(', ')) ||
      (err.response.data && err.response.data.message) ||
      'API error';

    res.status(status === 401 || status === 403 ? status : 502).json({
      error: message,
      apiStatus: status,
    });
    return;
  }

  // Config errors
  if (err.message && err.message.includes('Invalid Jira configuration')) {
    res.status(400).json({ error: err.message });
    return;
  }

  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
}

module.exports = { errorHandler };
