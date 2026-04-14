'use strict';
const { Router } = require('express');
const { z } = require('zod');
const ubicacionController = require('./ubicacion.controller');
const { requireAdmin, requireAuth } = require('../auth/auth.middleware');
const { validate } = require('../../shared/middlewares/validate.middleware');

const router = Router();

const crearSchema = z.object({
  clave: z.string().min(2, 'La clave es requerida'),
  nombre: z.string().min(2, 'El nombre es requerido'),
  descripcion: z.string().optional().default(''),
  activa: z.boolean().optional().default(true),
  permite_identificacion: z.boolean().optional().default(false),
  permite_prestamo_llaves: z.boolean().optional().default(false),
  permite_devolucion_llaves: z.boolean().optional().default(false),
  permite_prestamo_equipos: z.boolean().optional().default(false),
});

const actualizarSchema = crearSchema.partial().refine((obj) => Object.keys(obj).length > 0, {
  message: 'Debe enviar al menos un campo para actualizar',
});

/**
 * @openapi
 * /ubicaciones:
 *   get:
 *     tags: [Ubicaciones]
 *     summary: Listar ubicaciones
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de ubicaciones
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
 *                     ubicaciones:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Ubicacion'
 */
router.get('/', ...requireAuth, (req, res) => ubicacionController.listar(req, res));

/**
 * @openapi
 * /ubicaciones/{clave}:
 *   get:
 *     tags: [Ubicaciones]
 *     summary: Obtener ubicación por clave
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: clave
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Ubicación encontrada
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
 *                     ubicacion:
 *                       $ref: '#/components/schemas/Ubicacion'
 *       404:
 *         $ref: '#/components/schemas/ErrorNoEncontrado'
 */
router.get('/:clave', ...requireAuth, (req, res) => ubicacionController.obtener(req, res));

/**
 * @openapi
 * /ubicaciones:
 *   post:
 *     tags: [Ubicaciones]
 *     summary: Crear ubicación
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CrearUbicacionRequest'
 *     responses:
 *       201:
 *         description: Ubicación creada
 *       400:
 *         description: Datos inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorValidacion'
 */
router.post('/', ...requireAdmin, validate(crearSchema), (req, res) => ubicacionController.crear(req, res));

/**
 * @openapi
 * /ubicaciones/{id}:
 *   patch:
 *     tags: [Ubicaciones]
 *     summary: Actualizar ubicación
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
 *             $ref: '#/components/schemas/CrearUbicacionRequest'
 *     responses:
 *       200:
 *         description: Ubicación actualizada
 *       404:
 *         $ref: '#/components/schemas/ErrorNoEncontrado'
 */
router.patch('/:id', ...requireAdmin, validate(actualizarSchema), (req, res) => ubicacionController.actualizar(req, res));

/**
 * @openapi
 * /ubicaciones/{id}:
 *   delete:
 *     tags: [Ubicaciones]
 *     summary: Eliminar ubicación
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
 *         description: Ubicación eliminada
 *       404:
 *         $ref: '#/components/schemas/ErrorNoEncontrado'
 */
router.delete('/:id', ...requireAdmin, (req, res) => ubicacionController.eliminar(req, res));

module.exports = router;
