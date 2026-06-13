'use strict';
const { Router } = require('express');
const { z } = require('zod');
const llaveController = require('./llave.controller');
const { requireAuth } = require('../auth/auth.middleware');
const { validate } = require('../../shared/middlewares/validate.middleware');
const { UBICACIONES } = require('../../shared/constants/nfc.constants');

const router = Router();
const ubicacionSchema = z.string().trim().min(1, 'ubicacion es requerida');
const origenSchema = z.enum(['individual', 'programacion', 'reserva_semestral']);

const entregarSchema = z.object({
  nroidenti: z.string().min(1, 'Documento requerido'),
  profesor: z.string().min(1, 'Profesor requerido'),
  aula: z.string().min(1, 'Aula requerida'),
  hora_inicio: z.string().optional().default(''),
  hora_fin: z.string().optional().default(''),
  dia: z.string().optional().default(''),
  facultad: z.string().optional().default('No especificada'),
  motivo: z.string().optional().default(''),
  ubicacion: ubicacionSchema.optional().default(UBICACIONES.OFICINA),
  origen: origenSchema.optional().default('individual'),
  quien_reclama: z.enum(['docente', 'monitor', 'otra_persona', '']).optional().default('docente'),
  numero_documento_reclama: z.string().optional().default(''),
  nombre_reclama: z.string().optional().default(''),
  numero_contacto: z.string().optional().default(''),
});

const procesarNFCSchema = z.object({
  id_carnet: z.string().min(1, 'id_carnet requerido'),
  ubicacion: ubicacionSchema.optional().default(UBICACIONES.OFICINA),
});

const confirmarAnticipadoSchema = z.object({
  id_carnet: z.string().min(1, 'id_carnet requerido'),
  horario: z.string().min(1, 'horario requerido'),
  aula: z.string().min(1, 'aula requerida'),
  reserva_id: z.string().optional().default(''),
  rol: z.enum(['docente', 'monitor']).optional().default('docente'),
  documento_persona: z.string().optional().default(''),
  nombre_persona: z.string().optional().default(''),
  ubicacion: ubicacionSchema.optional().default(UBICACIONES.OFICINA),
});

/**
 * @openapi
 * /llaves/pendientes:
 *   get:
 *     tags: [Llaves]
 *     summary: Llaves pendientes de devolución (usuario actual)
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Llaves pendientes
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
 *                     llaves:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Llave'
 */
router.get('/pendientes', ...requireAuth, (req, res) => llaveController.pendientes(req, res));

/**
 * @openapi
 * /llaves/pendientes/todos:
 *   get:
 *     tags: [Llaves]
 *     summary: Todas las llaves pendientes de devolución
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Todas las llaves pendientes
 */
router.get('/pendientes/todos', ...requireAuth, (req, res) => llaveController.todosPendientes(req, res));

/**
 * @openapi
 * /llaves/dia:
 *   get:
 *     tags: [Llaves]
 *     summary: Llaves pendientes del día actual
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Llaves del día
 */
router.get('/dia', ...requireAuth, (req, res) => llaveController.pendientesHoy(req, res));

/**
 * @openapi
 * /llaves/historial:
 *   get:
 *     tags: [Llaves]
 *     summary: Historial de préstamos de llaves
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
 *       - in: query
 *         name: aula
 *         schema:
 *           type: string
 *       - in: query
 *         name: docente
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Historial de llaves
 */
router.get('/historial', ...requireAuth, (req, res) => llaveController.historial(req, res));

/**
 * @openapi
 * /llaves/historial/exportar:
 *   get:
 *     tags: [Llaves]
 *     summary: Exportar historial de llaves a Excel
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
 *         description: Archivo Excel
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get('/historial/exportar', ...requireAuth, (req, res) => llaveController.exportarHistorial(req, res));

/**
 * @openapi
 * /llaves/clases-hoy:
 *   get:
 *     tags: [Llaves]
 *     summary: Clases programadas procesadas hoy
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Clases procesadas del día
 */
router.get('/clases-hoy', ...requireAuth, (req, res) => llaveController.clasesProcesadasHoy(req, res));

/**
 * @openapi
 * /llaves/procesar-nfc:
 *   post:
 *     tags: [Llaves]
 *     summary: Procesar lectura NFC para préstamo/devolución de llave
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ProcesarNFCLlaveRequest'
 *     responses:
 *       200:
 *         description: Resultado del procesamiento NFC
 *       400:
 *         description: Datos inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorValidacion'
 */
router.post('/procesar-nfc', ...requireAuth, validate(procesarNFCSchema), (req, res) => llaveController.procesarNFC(req, res));

/**
 * @openapi
 * /llaves/confirmar-anticipado:
 *   post:
 *     tags: [Llaves]
 *     summary: Confirmar entrega anticipada de llave
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ConfirmarAnticipadoRequest'
 *     responses:
 *       200:
 *         description: Entrega anticipada confirmada
 *       400:
 *         description: Datos inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorValidacion'
 */
router.post('/confirmar-anticipado', ...requireAuth, validate(confirmarAnticipadoSchema), (req, res) => llaveController.confirmarAnticipado(req, res));

/**
 * @openapi
 * /llaves/entregar:
 *   post:
 *     tags: [Llaves]
 *     summary: Entregar llave manualmente
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EntregarLlaveRequest'
 *     responses:
 *       200:
 *         description: Llave entregada
 *       400:
 *         description: Datos inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorValidacion'
 */
router.post('/entregar', ...requireAuth, validate(entregarSchema), (req, res) => llaveController.entregar(req, res));

/**
 * @openapi
 * /llaves/devolver/{documento}:
 *   post:
 *     tags: [Llaves]
 *     summary: Devolver llave por documento
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
 *         description: Llave devuelta
 *       404:
 *         $ref: '#/components/schemas/ErrorNoEncontrado'
 */
router.post('/devolver/:documento', ...requireAuth, (req, res) => llaveController.devolver(req, res));
router.post('/devolver-registro/:id', ...requireAuth, (req, res) => llaveController.devolverPorId(req, res));

module.exports = router;
