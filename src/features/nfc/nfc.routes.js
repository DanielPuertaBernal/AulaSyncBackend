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
  evento_id: z.string().trim().min(1).max(120).optional(),
});

/**
 * @openapi
 * /nfc/status:
 *   get:
 *     tags: [NFC]
 *     summary: Obtener estado del sistema NFC
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Estado del sistema NFC
 */
router.get('/status', ...requireAuth, (req, res) => nfcController.obtenerEstado(req, res));

/**
 * @openapi
 * /nfc/lectura:
 *   post:
 *     tags: [NFC]
 *     summary: Procesar lectura NFC desde dispositivo ESP32
 *     description: Endpoint utilizado por los lectores NFC ESP32 para enviar lecturas de carnets.
 *     security:
 *       - DeviceKey: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LecturaNFCRequest'
 *     responses:
 *       200:
 *         description: Lectura procesada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/NFCEvento'
 *       401:
 *         description: Device key inválida
 *       400:
 *         description: Datos inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorValidacion'
 */
// Endpoint para el ESP32 (autenticado por X-Device-Key)
router.post('/lectura', nfcLimiter, verifyNfcDeviceKey, validate(lecturaSchema), (req, res) => nfcController.procesarLectura(req, res));

module.exports = router;
