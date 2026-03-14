'use strict';
const { Router } = require('express');
const { z } = require('zod');
const nfcController = require('./nfc.controller');
const { validate } = require('../../shared/middlewares/validate.middleware');

const router = Router();
const ubicacionSchema = z.enum(['oficina_centro_servicios_docentes', 'porteria_superior']);

const lecturaSchema = z.object({
  id_carnet: z.string().min(1, 'id_carnet es requerido'),
  ubicacion: ubicacionSchema.optional().default('oficina_centro_servicios_docentes'),
});

// Endpoint para el ESP32 (autenticado por X-Device-Key)
router.post('/lectura', validate(lecturaSchema), (req, res) => nfcController.procesarLectura(req, res));

module.exports = router;
