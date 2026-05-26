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

/**
 * @openapi
 * /notificaciones/estadisticas:
 *   get:
 *     tags: [Notificaciones]
 *     summary: Estadísticas de notificaciones agrupadas por estado y tipo (solo admin)
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Estadísticas de notificaciones
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       401:
 *         $ref: '#/components/responses/NoAutenticado'
 *       403:
 *         $ref: '#/components/responses/NoAutorizado'
 */
router.get(
  '/estadisticas',
  ...requireAdmin,
  (req, res) => notificacionController.estadisticas(req, res)
);

/**
 * @openapi
 * /notificaciones/reenviar/{id}:
 *   post:
 *     tags: [Notificaciones]
 *     summary: Reenviar una notificación fallida por su ID
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Notificación reenviada correctamente
 *       401:
 *         $ref: '#/components/responses/NoAutenticado'
 *       404:
 *         $ref: '#/components/responses/NoEncontrado'
 */
router.post(
  '/reenviar/:id',
  ...requireAuth,
  (req, res) => notificacionController.reenviar(req, res)
);

const enviarReservasManualSchema = z.object({
  reserva_ids: z.array(z.string().min(1)).min(1, 'Debe indicar al menos una reserva'),
  tipo_mensaje: z.enum(['predeterminado', 'personalizado']).default('predeterminado'),
  mensaje_personalizado: z.string().optional().default(''),
  asunto: z.string().optional().default(''),
});

router.post(
  '/reservas-manual',
  ...requireAuth,
  validate(enviarReservasManualSchema),
  (req, res) => notificacionController.enviarManualReservas(req, res)
);

module.exports = router;
