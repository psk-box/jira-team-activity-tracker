'use strict';

const { logger } = require('../services/logger');

function requestLogger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    logger.info(`${req.method} ${req.url} ${res.statusCode} ${Date.now() - start}ms`);
  });
  next();
}

module.exports = { requestLogger };
