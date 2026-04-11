'use strict';
const { Router } = require('express');
const { z } = require('zod');
const nfcController = require('./nfc.controller');
const { verifyNfcDeviceKey } = require('./nfc.middleware');
const { requireAuth } = require('../auth/auth.middleware');
const { validate } = require('../../shared/middlewares/validate.middleware');
const { nfcLimiter } = require('../../shared/middlewares/rate.limiter');
const { UBICACIONES } = require('../../shared/constants/nfc.constants');

const router = Router();
const ubicacionSchema = z.string().trim().min(1, 'ubicacion es requerida');

const lecturaSchema = z.object({
  id_carnet: z.string().min(1, 'id_carnet es requerido'),
  ubicacion: ubicacionSchema.optional().default(UBICACIONES.OFICINA),
});

router.get('/status', ...requireAuth, (req, res) => nfcController.obtenerEstado(req, res));

// Endpoint para el ESP32 (autenticado por X-Device-Key)
router.post('/lectura', nfcLimiter, verifyNfcDeviceKey, validate(lecturaSchema), (req, res) => nfcController.procesarLectura(req, res));

module.exports = router;
