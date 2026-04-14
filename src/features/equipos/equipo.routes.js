'use strict';
const { Router } = require('express');
const { z } = require('zod');
const equipoController = require('./equipo.controller');
const { requireAuth } = require('../auth/auth.middleware');
const { validate } = require('../../shared/middlewares/validate.middleware');

const router = Router();

const crearSchema = z.object({
  nombre: z.string().min(1),
  marca: z.string().optional().default(''),
  consecutivo: z.union([z.string(), z.number()]),
  codigo_inventario: z.string().min(1),
  descripcion: z.string().optional().default(''),
});

const actualizarSchema = z.object({
  nombre: z.string().min(1).optional(),
  marca: z.string().optional(),
  consecutivo: z.union([z.string(), z.number()]).optional(),
  codigo_inventario: z.string().min(1).optional(),
  descripcion: z.string().optional(),
  estado: z.enum(['activo', 'inactivo', 'mantenimiento']).optional(),
}).strict();

/**
 * @openapi
 * /equipos:
 *   get:
 *     tags: [Equipos]
 *     summary: Listar equipos
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de equipos
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
 *                     equipos:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Equipo'
 */
router.get('/', ...requireAuth, (req, res) => equipoController.listar(req, res));

/**
 * @openapi
 * /equipos/disponibles:
 *   get:
 *     tags: [Equipos]
 *     summary: Listar equipos disponibles para préstamo
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Equipos disponibles
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
 *                     equipos:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Equipo'
 */
router.get('/disponibles', ...requireAuth, (req, res) => equipoController.disponibles(req, res));

/**
 * @openapi
 * /equipos/barcode/{codigo}:
 *   get:
 *     tags: [Equipos]
 *     summary: Buscar equipo por código de barras
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: codigo
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Equipo encontrado
 *       404:
 *         $ref: '#/components/schemas/ErrorNoEncontrado'
 */
router.get('/barcode/:codigo', ...requireAuth, (req, res) => equipoController.buscarPorBarcode(req, res));

/**
 * @openapi
 * /equipos:
 *   post:
 *     tags: [Equipos]
 *     summary: Crear equipo
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CrearEquipoRequest'
 *     responses:
 *       201:
 *         description: Equipo creado
 *       400:
 *         description: Datos inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorValidacion'
 */
router.post('/', ...requireAuth, validate(crearSchema), (req, res) => equipoController.crear(req, res));

/**
 * @openapi
 * /equipos/{id}:
 *   patch:
 *     tags: [Equipos]
 *     summary: Actualizar equipo
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
 *             $ref: '#/components/schemas/ActualizarEquipoRequest'
 *     responses:
 *       200:
 *         description: Equipo actualizado
 *       404:
 *         $ref: '#/components/schemas/ErrorNoEncontrado'
 */
router.patch('/:id', ...requireAuth, validate(actualizarSchema), (req, res) => equipoController.actualizar(req, res));

/**
 * @openapi
 * /equipos/{id}:
 *   delete:
 *     tags: [Equipos]
 *     summary: Eliminar equipo
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
 *         description: Equipo eliminado
 *       404:
 *         $ref: '#/components/schemas/ErrorNoEncontrado'
 */
router.delete('/:id', ...requireAuth, (req, res) => equipoController.eliminar(req, res));

module.exports = router;
