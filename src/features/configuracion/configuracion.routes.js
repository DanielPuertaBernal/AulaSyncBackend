'use strict';
const { Router } = require('express');
const { z } = require('zod');
const configuracionController = require('./configuracion.controller');
const { requireAdmin, requireAuth } = require('../auth/auth.middleware');
const { validate } = require('../../shared/middlewares/validate.middleware');

const router = Router();

const guardarSchema = z.object({
  tiempo_maximo_prestamo_minutos: z.number().min(5).max(1440).optional(),
  intervalo_recordatorio_minutos: z.number().min(5).max(1440).optional(),
  max_recordatorios: z.number().min(1).max(20).optional(),
  notificaciones_activas: z.boolean().optional(),
});

/**
 * @openapi
 * /configuracion:
 *   get:
 *     tags: [Configuración]
 *     summary: Listar la configuración de todos los bloques
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Listado de configuraciones por bloque
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
 *                     configuraciones:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/ConfiguracionBloque'
 *       401:
 *         $ref: '#/components/responses/NoAutenticado'
 */
router.get('/', ...requireAuth, (req, res) => configuracionController.listar(req, res));

/**
 * @openapi
 * /configuracion/defaults:
 *   get:
 *     tags: [Configuración]
 *     summary: Obtener los valores por defecto del sistema
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Valores por defecto de configuración
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
 *                     defaults:
 *                       $ref: '#/components/schemas/ConfiguracionBloque'
 *       401:
 *         $ref: '#/components/responses/NoAutenticado'
 */
router.get('/defaults', ...requireAuth, (req, res) => configuracionController.defaults(req, res));

router.put('/defaults', ...requireAdmin, validate(guardarSchema), (req, res) =>
  configuracionController.guardarDefaults(req, res)
);

/**
 * @openapi
 * /configuracion/{bloque}:
 *   get:
 *     tags: [Configuración]
 *     summary: Obtener la configuración de un bloque específico
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bloque
 *         required: true
 *         description: Nombre del bloque
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Configuración del bloque
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
 *                     configuracion:
 *                       $ref: '#/components/schemas/ConfiguracionBloque'
 *       401:
 *         $ref: '#/components/responses/NoAutenticado'
 *       404:
 *         $ref: '#/components/responses/NoEncontrado'
 */
router.get('/:bloque', ...requireAuth, (req, res) => configuracionController.obtener(req, res));

/**
 * @openapi
 * /configuracion/{bloque}:
 *   put:
 *     tags: [Configuración]
 *     summary: Guardar o actualizar la configuración de un bloque (solo admin)
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bloque
 *         required: true
 *         description: Nombre del bloque
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               tiempo_maximo_prestamo_minutos:
 *                 type: integer
 *                 minimum: 5
 *                 maximum: 1440
 *               intervalo_recordatorio_minutos:
 *                 type: integer
 *                 minimum: 5
 *                 maximum: 1440
 *               max_recordatorios:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 20
 *               notificaciones_activas:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Configuración guardada correctamente
 *       400:
 *         $ref: '#/components/responses/ErrorValidacion'
 *       401:
 *         $ref: '#/components/responses/NoAutenticado'
 *       403:
 *         $ref: '#/components/responses/NoAutorizado'
 */
router.put('/:bloque', ...requireAdmin, validate(guardarSchema), (req, res) => configuracionController.guardar(req, res));

/**
 * @openapi
 * /configuracion/{bloque}:
 *   delete:
 *     tags: [Configuración]
 *     summary: Eliminar la configuración personalizada de un bloque (solo admin)
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bloque
 *         required: true
 *         description: Nombre del bloque
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Configuración eliminada correctamente
 *       401:
 *         $ref: '#/components/responses/NoAutenticado'
 *       403:
 *         $ref: '#/components/responses/NoAutorizado'
 *       404:
 *         $ref: '#/components/responses/NoEncontrado'
 */
router.delete('/:bloque', ...requireAdmin, (req, res) => configuracionController.eliminar(req, res));

module.exports = router;
