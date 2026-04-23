'use strict';
const { Router } = require('express');
const { z } = require('zod');
const reservaController = require('./reserva.controller');
const { requireAdmin, requireAuth } = require('../auth/auth.middleware');
const { validate } = require('../../shared/middlewares/validate.middleware');

const router = Router();

const crearReservaSchema = z.object({
  solicitante_documento: z.string().min(1, 'Documento requerido'),
  solicitante_nombre: z.string().min(1, 'Nombre requerido'),
  nombre_bloque: z.string().min(1, 'Bloque requerido'),
  nombre_salon: z.string().min(1, 'Salón requerido'),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha debe ser YYYY-MM-DD'),
  hora_inicio: z.string().regex(/^\d{2}:\d{2}$/, 'Hora debe ser HH:MM'),
  hora_fin: z.string().regex(/^\d{2}:\d{2}$/, 'Hora debe ser HH:MM'),
  motivo: z.string().max(500).optional().default(''),
  tipo_solicitante: z.enum(['docente', 'estudiante']).optional().default('docente'),
  responsable_documento: z.string().optional().default(''),
  responsable_nombre: z.string().optional().default(''),
});

const validarReservaSchema = z.object({
  nombre_salon: z.string().min(1),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hora_inicio: z.string().regex(/^\d{2}:\d{2}$/),
  hora_fin: z.string().regex(/^\d{2}:\d{2}$/),
});

/**
 * @openapi
 * /reservas/validar:
 *   post:
 *     tags: [Reservas]
 *     summary: Validar disponibilidad de un salón en un horario específico
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nombre_salon, fecha, hora_inicio, hora_fin]
 *             properties:
 *               nombre_salon:
 *                 type: string
 *               fecha:
 *                 type: string
 *                 format: date
 *               hora_inicio:
 *                 type: string
 *                 example: "08:00"
 *               hora_fin:
 *                 type: string
 *                 example: "10:00"
 *     responses:
 *       200:
 *         description: Resultado de la validación de disponibilidad
 *       400:
 *         $ref: '#/components/responses/ErrorValidacion'
 *       401:
 *         $ref: '#/components/responses/NoAutenticado'
 */
router.post(
  '/validar',
  ...requireAuth,
  validate(validarReservaSchema),
  (req, res) => reservaController.validar(req, res)
);

/**
 * @openapi
 * /reservas:
 *   post:
 *     tags: [Reservas]
 *     summary: Crear una nueva reserva de salón
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [solicitante_documento, solicitante_nombre, nombre_bloque, nombre_salon, fecha, hora_inicio, hora_fin]
 *             properties:
 *               solicitante_documento:
 *                 type: string
 *               solicitante_nombre:
 *                 type: string
 *               nombre_bloque:
 *                 type: string
 *               nombre_salon:
 *                 type: string
 *               fecha:
 *                 type: string
 *                 format: date
 *               hora_inicio:
 *                 type: string
 *                 example: "08:00"
 *               hora_fin:
 *                 type: string
 *                 example: "10:00"
 *               motivo:
 *                 type: string
 *                 maxLength: 500
 *     responses:
 *       201:
 *         description: Reserva creada correctamente
 *       400:
 *         $ref: '#/components/responses/ErrorValidacion'
 *       401:
 *         $ref: '#/components/responses/NoAutenticado'
 *       409:
 *         description: Conflicto de horario con otra reserva existente
 */
router.post(
  '/',
  ...requireAuth,
  validate(crearReservaSchema),
  (req, res) => reservaController.crear(req, res)
);

/**
 * @openapi
 * /reservas:
 *   get:
 *     tags: [Reservas]
 *     summary: Listar reservas con filtros opcionales y paginación
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: nombre_bloque
 *         schema:
 *           type: string
 *       - in: query
 *         name: nombre_salon
 *         schema:
 *           type: string
 *       - in: query
 *         name: estado
 *         schema:
 *           type: string
 *           enum: [pendiente, aprobada, rechazada, completada, cancelada]
 *       - in: query
 *         name: fecha
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: busqueda
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Listado de reservas
 *       401:
 *         $ref: '#/components/responses/NoAutenticado'
 */
router.get(
  '/',
  ...requireAuth,
  (req, res) => reservaController.listar(req, res)
);

/**
 * @openapi
 * /reservas/disponibilidad:
 *   get:
 *     tags: [Reservas]
 *     summary: Consultar disponibilidad de un salón en una fecha
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: nombre_salon
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: fecha
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Slots de disponibilidad del salón en la fecha indicada
 *       400:
 *         description: Parámetros requeridos faltantes
 *       401:
 *         $ref: '#/components/responses/NoAutenticado'
 */
router.get(
  '/disponibilidad',
  ...requireAuth,
  (req, res) => reservaController.disponibilidad(req, res)
);

router.get(
  '/disponibilidad-smart',
  ...requireAuth,
  (req, res) => reservaController.disponibilidadSmart(req, res)
);

/**
 * @openapi
 * /reservas/{id}/aprobar:
 *   post:
 *     tags: [Reservas]
 *     summary: Aprobar una reserva pendiente (solo admin)
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
 *         description: Reserva aprobada correctamente
 *       401:
 *         $ref: '#/components/responses/NoAutenticado'
 *       403:
 *         $ref: '#/components/responses/NoAutorizado'
 *       404:
 *         $ref: '#/components/responses/NoEncontrado'
 */
router.post(
  '/:id/aprobar',
  ...requireAdmin,
  (req, res) => reservaController.aprobar(req, res)
);

/**
 * @openapi
 * /reservas/{id}/rechazar:
 *   post:
 *     tags: [Reservas]
 *     summary: Rechazar una reserva pendiente (solo admin)
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
 *         description: Reserva rechazada correctamente
 *       401:
 *         $ref: '#/components/responses/NoAutenticado'
 *       403:
 *         $ref: '#/components/responses/NoAutorizado'
 *       404:
 *         $ref: '#/components/responses/NoEncontrado'
 */
router.post(
  '/:id/rechazar',
  ...requireAdmin,
  (req, res) => reservaController.rechazar(req, res)
);

/**
 * @openapi
 * /reservas/{id}/cancelar:
 *   post:
 *     tags: [Reservas]
 *     summary: Cancelar una reserva (usuario autenticado)
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
 *         description: Reserva cancelada correctamente
 *       401:
 *         $ref: '#/components/responses/NoAutenticado'
 *       404:
 *         $ref: '#/components/responses/NoEncontrado'
 */
router.post(
  '/:id/cancelar',
  ...requireAuth,
  (req, res) => reservaController.cancelar(req, res)
);

module.exports = router;
