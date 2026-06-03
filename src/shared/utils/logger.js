'use strict';

const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

const currentLevel = () => {
  const env = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');
  return LOG_LEVELS[env] ?? LOG_LEVELS.info;
};

const timestamp = () => new Date().toISOString();

const format = (level, context, message, meta) => {
  const base = `${timestamp()} [${level.toUpperCase()}] [${context}] ${message}`;
  if (!meta) return base;
  if (meta instanceof Error) return `${base} | ${meta.message}\n${meta.stack}`;
  if (typeof meta === 'object') return `${base} | ${JSON.stringify(meta)}`;
  return `${base} | ${meta}`;
};

const createLogger = (context) => ({
  error: (msg, meta) => {
    if (currentLevel() >= LOG_LEVELS.error) console.error(format('error', context, msg, meta));
  },
  warn: (msg, meta) => {
    if (currentLevel() >= LOG_LEVELS.warn) console.warn(format('warn', context, msg, meta));
  },
  info: (msg, meta) => {
    if (currentLevel() >= LOG_LEVELS.info) console.log(format('info', context, msg, meta));
  },
  debug: (msg, meta) => {
    if (currentLevel() >= LOG_LEVELS.debug) console.log(format('debug', context, msg, meta));
  },
});

module.exports = { createLogger };
