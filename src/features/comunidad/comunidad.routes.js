'use strict';
const { Router } = require('express');
const comunidadController = require('./comunidad.controller');
const { requireAuth, requireAdmin } = require('../auth/auth.middleware');

const router = Router();

/**
 * @openapi
 * /comunidad:
 *   get:
 *     tags: [Comunidad]
 *     summary: Listar miembros de la comunidad
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: tipo
 *         schema:
 *           type: string
 *           enum: [docente, estudiante, empleado]
 *         description: Filtrar por tipo
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Búsqueda por nombre o documento
 *     responses:
 *       200:
 *         description: Lista de personas
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
 *                     personas:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Comunidad'
 */
router.get('/', ...requireAuth, (req, res) => comunidadController.listar(req, res));

/**
 * @openapi
 * /comunidad/carnet/{idCarnet}:
 *   get:
 *     tags: [Comunidad]
 *     summary: Buscar por carnet NFC
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idCarnet
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Persona encontrada
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
 *                     persona:
 *                       $ref: '#/components/schemas/Comunidad'
 *       404:
 *         $ref: '#/components/schemas/ErrorNoEncontrado'
 */
router.get('/carnet/:idCarnet', ...requireAuth, (req, res) => comunidadController.obtenerPorCarnet(req, res));

/**
 * @openapi
 * /comunidad/{documento}:
 *   get:
 *     tags: [Comunidad]
 *     summary: Buscar por número de documento
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: documento
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Persona encontrada
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
 *                     persona:
 *                       $ref: '#/components/schemas/Comunidad'
 *       404:
 *         $ref: '#/components/schemas/ErrorNoEncontrado'
 */
router.get('/:documento', ...requireAuth, (req, res) => comunidadController.obtener(req, res));

/**
 * @openapi
 * /comunidad/sync:
 *   post:
 *     tags: [Comunidad]
 *     summary: Sincronizar registros desde sistema externo
 *     description: Acepta un registro individual o un arreglo de registros. No requiere autenticación.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SyncRequest'
 *     responses:
 *       200:
 *         description: Registros sincronizados
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     insertados:
 *                       type: integer
 *                     actualizados:
 *                       type: integer
 *                     errores:
 *                       type: array
 *                       items:
 *                         type: object
 *       400:
 *         description: Datos inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorValidacion'
 */
// Endpoint de sincronización — sin autenticación (sistema externo)
router.post('/sync', (req, res) => comunidadController.sync(req, res));

router.patch('/:id', ...requireAdmin, (req, res) => comunidadController.actualizar(req, res));
router.delete('/:id', ...requireAdmin, (req, res) => comunidadController.eliminar(req, res));

module.exports = router;
