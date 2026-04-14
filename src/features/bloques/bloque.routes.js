'use strict';
const { Router } = require('express');
const { z } = require('zod');
const bloqueController = require('./bloque.controller');
const { requireAdmin } = require('../auth/auth.middleware');
const { validate } = require('../../shared/middlewares/validate.middleware');

const router = Router();

const crearSchema = z.object({
  nombre_bloque: z.string().min(1, 'nombre_bloque es requerido'),
});

const actualizarSchema = z.object({
  nombre_bloque: z.string().min(1, 'nombre_bloque es requerido'),
});

/**
 * @openapi
 * /bloques:
 *   get:
 *     tags: [Bloques]
 *     summary: Listar bloques
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de bloques
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
 *                     bloques:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Bloque'
 */
router.get('/', ...requireAdmin, (req, res) => bloqueController.listar(req, res));

/**
 * @openapi
 * /bloques:
 *   post:
 *     tags: [Bloques]
 *     summary: Crear bloque
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CrearBloqueRequest'
 *     responses:
 *       201:
 *         description: Bloque creado
 *       400:
 *         description: Datos inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorValidacion'
 */
router.post('/', ...requireAdmin, validate(crearSchema), (req, res) => bloqueController.crear(req, res));

/**
 * @openapi
 * /bloques/{id}:
 *   patch:
 *     tags: [Bloques]
 *     summary: Actualizar bloque
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
 *             $ref: '#/components/schemas/CrearBloqueRequest'
 *     responses:
 *       200:
 *         description: Bloque actualizado
 *       404:
 *         $ref: '#/components/schemas/ErrorNoEncontrado'
 */
router.patch('/:id', ...requireAdmin, validate(actualizarSchema), (req, res) => bloqueController.actualizar(req, res));

/**
 * @openapi
 * /bloques/{id}:
 *   delete:
 *     tags: [Bloques]
 *     summary: Eliminar bloque
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
 *         description: Bloque eliminado
 *       404:
 *         $ref: '#/components/schemas/ErrorNoEncontrado'
 */
router.delete('/:id', ...requireAdmin, (req, res) => bloqueController.eliminar(req, res));

module.exports = router;
