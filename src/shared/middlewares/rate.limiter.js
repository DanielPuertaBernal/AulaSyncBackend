'use strict';
const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: 'Demasiados intentos. Intente de nuevo en 15 minutos.' },
});

const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: 'Demasiadas solicitudes de refresh. Intente más tarde.' },
});

const nfcLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.NFC_RATE_LIMIT_MAX || '120', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: 'Demasiadas lecturas NFC en poco tiempo. Intente nuevamente en un minuto.' },
});

module.exports = { authLimiter, refreshLimiter, nfcLimiter };
