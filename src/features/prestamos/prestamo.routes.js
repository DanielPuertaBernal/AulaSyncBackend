'use strict';
const { Router } = require('express');
const { z } = require('zod');
const prestamoController = require('./prestamo.controller');
const { requireAuth } = require('../auth/auth.middleware');
const { validate } = require('../../shared/middlewares/validate.middleware');
const { UBICACIONES } = require('../../shared/constants/nfc.constants');

const router = Router();
const ubicacionOficinaSchema = z.string().trim().min(1, 'ubicación requerida');

const crearSchema = z.object({
  docente_codigo_nfc: z.string().min(1),
  docente_nombre: z.string().min(1),
  equipos: z.array(z.union([z.string(), z.record(z.any())])).min(1),
  auxiliar_prestamista: z.string().optional(),
  ubicacion_prestamo: ubicacionOficinaSchema.optional().default(UBICACIONES.OFICINA),
});

const devolucionSchema = z.object({
  prestamo_id: z.string().min(1),
  docente_codigo_nfc: z.string().optional().default(''),
  docente_nombre: z.string().optional().default(''),
  equipos: z.array(z.union([z.string(), z.record(z.any())])).optional().default([]),
  auxiliar_que_recibio: z.string().optional(),
  ubicacion_devolucion: ubicacionOficinaSchema.optional().default(UBICACIONES.OFICINA),
});

/**
 * @openapi
 * /prestamos:
 *   get:
 *     tags: [Préstamos]
 *     summary: Listar préstamos de equipos
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de préstamos
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
 *                     prestamos:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Prestamo'
 */
router.get('/', ...requireAuth, (req, res) => prestamoController.listar(req, res));

/**
 * @openapi
 * /prestamos/activos:
 *   get:
 *     tags: [Préstamos]
 *     summary: Listar préstamos activos
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Préstamos activos
 */
router.get('/activos', ...requireAuth, (req, res) => prestamoController.activos(req, res));

/**
 * @openapi
 * /prestamos/docente/{nfc}:
 *   get:
 *     tags: [Préstamos]
 *     summary: Préstamos activos de un docente por NFC
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: nfc
 *         required: true
 *         schema:
 *           type: string
 *         description: Código NFC del docente
 *     responses:
 *       200:
 *         description: Préstamos del docente
 *       404:
 *         $ref: '#/components/schemas/ErrorNoEncontrado'
 */
router.get('/docente/:nfc', ...requireAuth, (req, res) => prestamoController.porDocente(req, res));

/**
 * @openapi
 * /prestamos:
 *   post:
 *     tags: [Préstamos]
 *     summary: Crear préstamo de equipos
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CrearPrestamoRequest'
 *     responses:
 *       201:
 *         description: Préstamo creado
 *       400:
 *         description: Datos inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorValidacion'
 */
router.post('/', ...requireAuth, validate(crearSchema), (req, res) => prestamoController.crear(req, res));

/**
 * @openapi
 * /prestamos/{id}/equipos:
 *   post:
 *     tags: [Préstamos]
 *     summary: Agregar equipo a préstamo existente
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
 *         description: Equipo agregado
 *       404:
 *         $ref: '#/components/schemas/ErrorNoEncontrado'
 */
router.post('/:id/equipos', ...requireAuth, (req, res) => prestamoController.agregarEquipo(req, res));

/**
 * @openapi
 * /prestamos/devolucion:
 *   post:
 *     tags: [Préstamos]
 *     summary: Registrar devolución de equipos
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DevolucionRequest'
 *     responses:
 *       200:
 *         description: Devolución registrada
 *       400:
 *         description: Datos inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorValidacion'
 */
router.post('/devolucion', ...requireAuth, validate(devolucionSchema), (req, res) => prestamoController.devolucion(req, res));

module.exports = router;
