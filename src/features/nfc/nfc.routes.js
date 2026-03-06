'use strict';
const { Router } = require('express');
const { z } = require('zod');
const nfcController = require('./nfc.controller');
const { validate } = require('../../shared/middlewares/validate.middleware');

const router = Router();

const lecturaSchema = z.object({
  id_carnet: z.string().min(1, 'id_carnet es requerido'),
});

// Endpoint para el ESP32 (autenticado por X-Device-Key)
router.post('/lectura', validate(lecturaSchema), (req, res) => nfcController.procesarLectura(req, res));

module.exports = router;
