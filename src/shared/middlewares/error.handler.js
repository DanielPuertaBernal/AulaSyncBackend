'use strict';
const { createLogger } = require('../utils/logger');
const log = createLogger('ErrorHandler');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  log.error(`${req.method} ${req.path}`, err);

  // Zod validation error
  if (err.name === 'ZodError') {
    return res.status(400).json({
      ok: false,
      message: 'Datos inválidos',
      errors: err.errors.map((e) => ({ campo: e.path.join('.'), mensaje: e.message })),
    });
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((e) => ({
      campo: e.path,
      mensaje: e.message,
    }));
    return res.status(400).json({ ok: false, message: 'Error de validación', errors });
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'campo';
    return res.status(409).json({
      ok: false,
      message: `Ya existe un registro con ese ${field}`,
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ ok: false, message: 'Token inválido' });
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ ok: false, message: 'Token expirado' });
  }

  // Errores con statusCode personalizados
  const status = err.statusCode || err.status || 500;
  const message = status < 500 ? err.message : 'Error interno del servidor';
  const body = { ok: false, message };
  if (err.data !== undefined) body.data = err.data;

  return res.status(status).json(body);
}

module.exports = errorHandler;
