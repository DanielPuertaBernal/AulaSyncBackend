'use strict';
const { Router } = require('express');
const { z } = require('zod');
const monitorController = require('./monitor.controller');
const { requireAuth } = require('../auth/auth.middleware');
const { validate } = require('../../shared/middlewares/validate.middleware');

const router = Router();

const registrarSchema = z.object({
  numero_documento_docente: z.string().min(1, 'Documento del docente requerido'),
  numero_documento_monitor: z.string().min(1, 'Documento del monitor requerido'),
  materia: z.string().min(1, 'Materia requerida'),
  aula: z.string().optional().default(''),
  horario: z.string().optional().default(''),
  dia: z.string().optional().default(''),
});

/**
 * @openapi
 * /monitores:
 *   get:
 *     tags: [Monitores]
 *     summary: Listar monitores registrados
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de monitores
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
 *                     monitores:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Monitor'
 */
router.get('/', ...requireAuth, (req, res) => monitorController.listar(req, res));

/**
 * @openapi
 * /monitores/clases/{documento}:
 *   get:
 *     tags: [Monitores]
 *     summary: Obtener clases de un docente con monitor
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: documento
 *         required: true
 *         schema:
 *           type: string
 *         description: Número de documento del docente
 *     responses:
 *       200:
 *         description: Clases del docente
 */
router.get('/clases/:documento', ...requireAuth, (req, res) => monitorController.clasesDocente(req, res));

/**
 * @openapi
 * /monitores:
 *   post:
 *     tags: [Monitores]
 *     summary: Registrar monitor
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegistrarMonitorRequest'
 *     responses:
 *       201:
 *         description: Monitor registrado
 *       400:
 *         description: Datos inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorValidacion'
 */
router.post('/', ...requireAuth, validate(registrarSchema), (req, res) => monitorController.registrar(req, res));

/**
 * @openapi
 * /monitores/{id}:
 *   delete:
 *     tags: [Monitores]
 *     summary: Eliminar monitor
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
 *         description: Monitor eliminado
 *       404:
 *         $ref: '#/components/schemas/ErrorNoEncontrado'
 */
router.delete('/:id', ...requireAuth, (req, res) => monitorController.eliminar(req, res));

module.exports = router;
