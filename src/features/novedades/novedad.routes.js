'use strict';
const { Router } = require('express');
const { z } = require('zod');
const novedadController = require('./novedad.controller');
const { requireAdmin, requireAuth } = require('../auth/auth.middleware');
const { validate } = require('../../shared/middlewares/validate.middleware');

const router = Router();

const registrarNovedadSchema = z.object({
  tipo_recurso: z.enum(['llave', 'equipo']),
  recurso_id: z.string().optional().default(''),
  prestamo_ref: z.string().optional().default(''),
  reportado_por: z.string().optional().default(''),
  reportado_por_nombre: z.string().optional().default(''),
  salon: z.string().optional().default(''),
  categoria: z.enum(['sin_novedad', 'daño_fisico', 'no_funciona', 'perdida', 'otro']),
  descripcion: z.string().max(500).optional().default(''),
});

const actualizarEstadoSchema = z.object({
  estado: z.enum(['abierta', 'en_revision', 'resuelta', 'cerrada']),
  resolucion: z.string().max(500).optional(),
});

/**
 * @openapi
 * /novedades:
 *   post:
 *     tags: [Novedades]
 *     summary: Registrar una novedad sobre una llave o equipo
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [tipo_recurso, categoria]
 *             properties:
 *               tipo_recurso:
 *                 type: string
 *                 enum: [llave, equipo]
 *               recurso_id:
 *                 type: string
 *               prestamo_ref:
 *                 type: string
 *               salon:
 *                 type: string
 *               categoria:
 *                 type: string
 *                 enum: [sin_novedad, daño_fisico, no_funciona, perdida, otro]
 *               descripcion:
 *                 type: string
 *                 maxLength: 500
 *     responses:
 *       201:
 *         description: Novedad registrada
 *       400:
 *         $ref: '#/components/responses/ErrorValidacion'
 *       401:
 *         $ref: '#/components/responses/NoAutenticado'
 */
router.post(
  '/',
  ...requireAuth,
  validate(registrarNovedadSchema),
  (req, res) => novedadController.registrar(req, res)
);

/**
 * @openapi
 * /novedades:
 *   get:
 *     tags: [Novedades]
 *     summary: Listar novedades con filtros opcionales y paginación
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: tipo_recurso
 *         schema:
 *           type: string
 *           enum: [llave, equipo]
 *       - in: query
 *         name: estado
 *         schema:
 *           type: string
 *           enum: [abierta, en_revision, resuelta, cerrada]
 *       - in: query
 *         name: categoria
 *         schema:
 *           type: string
 *           enum: [sin_novedad, daño_fisico, no_funciona, perdida, otro]
 *       - in: query
 *         name: busqueda
 *         schema:
 *           type: string
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
 *         description: Listado de novedades
 *       401:
 *         $ref: '#/components/responses/NoAutenticado'
 */
router.get(
  '/',
  ...requireAuth,
  (req, res) => novedadController.listar(req, res)
);

/**
 * @openapi
 * /novedades/estadisticas:
 *   get:
 *     tags: [Novedades]
 *     summary: Estadísticas de novedades agrupadas por estado y categoría
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Estadísticas de novedades
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
  (req, res) => novedadController.estadisticas(req, res)
);

/**
 * @openapi
 * /novedades/{id}:
 *   get:
 *     tags: [Novedades]
 *     summary: Obtener detalle de una novedad por ID
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
 *         description: Detalle de la novedad
 *       401:
 *         $ref: '#/components/responses/NoAutenticado'
 *       404:
 *         $ref: '#/components/responses/NoEncontrado'
 */
router.get(
  '/:id',
  ...requireAuth,
  (req, res) => novedadController.obtener(req, res)
);

/**
 * @openapi
 * /novedades/{id}/estado:
 *   patch:
 *     tags: [Novedades]
 *     summary: Actualizar el estado de una novedad (solo admin)
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [estado]
 *             properties:
 *               estado:
 *                 type: string
 *                 enum: [abierta, en_revision, resuelta, cerrada]
 *               resolucion:
 *                 type: string
 *                 maxLength: 500
 *     responses:
 *       200:
 *         description: Estado actualizado correctamente
 *       400:
 *         $ref: '#/components/responses/ErrorValidacion'
 *       401:
 *         $ref: '#/components/responses/NoAutenticado'
 *       403:
 *         $ref: '#/components/responses/NoAutorizado'
 *       404:
 *         $ref: '#/components/responses/NoEncontrado'
 */
router.patch(
  '/:id/estado',
  ...requireAdmin,
  validate(actualizarEstadoSchema),
  (req, res) => novedadController.actualizarEstado(req, res)
);

module.exports = router;
