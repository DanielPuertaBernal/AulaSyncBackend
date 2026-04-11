'use strict';

const crypto = require('crypto');

function verifyNfcDeviceKey(req, res, next) {
  const deviceKey = String(req.headers['x-device-key'] || '');
  const expectedKey = String(process.env.ESP32_DEVICE_KEY);

  if (!deviceKey || !expectedKey) {
    return res.status(403).json({ ok: false, message: 'Device key inválido' });
  }

  const provided = Buffer.from(deviceKey);
  const expected = Buffer.from(expectedKey);

  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
    return res.status(403).json({ ok: false, message: 'Device key inválido' });
  }

  return next();
}

module.exports = { verifyNfcDeviceKey };
