'use strict';
const { Router } = require('express');
const { z } = require('zod');
const notificacionController = require('./notificacion.controller');
const { requireAdmin, requireAuth } = require('../auth/auth.middleware');
const { validate } = require('../../shared/middlewares/validate.middleware');

const router = Router();

const destinatarioSchema = z.object({
  nombre: z.string().min(1, 'Nombre requerido'),
  documento: z.string().min(1, 'Documento requerido'),
  correo: z.string().email('Correo inválido'),
  salon: z.string().optional().default(''),
  fecha_prestamo: z.string().min(1, 'Fecha de préstamo requerida'),
  tiempo_transcurrido: z.string().optional().default(''),
  llave_id: z.string().optional().default(''),
});

const enviarNotificacionSchema = z.object({
  destinatarios: z.array(destinatarioSchema).min(1, 'Debe seleccionar al menos un destinatario'),
  tipo_mensaje: z.enum(['predeterminado', 'personalizado']),
  mensaje_personalizado: z.string().optional().default(''),
  asunto: z.string().optional().default(''),
});

/**
 * @openapi
 * /notificaciones/devolucion-llaves:
 *   post:
 *     tags: [Notificaciones]
 *     summary: Enviar notificación de devolución de llaves
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EnviarNotificacionRequest'
 *     responses:
 *       200:
 *         description: Notificación enviada
 *       400:
 *         description: Datos inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorValidacion'
 */
router.post(
  '/devolucion-llaves',
  ...requireAuth,
  validate(enviarNotificacionSchema),
  (req, res) => notificacionController.enviarDevolucionLlaves(req, res)
);

/**
 * @openapi
 * /notificaciones/historial:
 *   get:
 *     tags: [Notificaciones]
 *     summary: Historial de notificaciones enviadas
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: desde
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: hasta
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Historial de notificaciones
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     notificaciones:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Notificacion'
 */
router.get(
  '/historial',
  ...requireAuth,
  (req, res) => notificacionController.historial(req, res)
);

module.exports = router;
