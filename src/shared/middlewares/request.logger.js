'use strict';
const { createLogger } = require('../utils/logger');
const log = createLogger('HTTP');

const requestLogger = (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const message = `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`;

    if (res.statusCode >= 500) log.error(message);
    else if (res.statusCode >= 400) log.warn(message);
    else log.info(message);
  });

  next();
};

module.exports = requestLogger;
