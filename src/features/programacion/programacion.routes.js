'use strict';
const { Router } = require('express');
const multer = require('multer');
const programacionController = require('./programacion.controller');
const { requireAuth, requireAdmin } = require('../auth/auth.middleware');

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

/**
 * @openapi
 * /programacion:
 *   get:
 *     tags: [Programación]
 *     summary: Listar programación académica
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: semestre
 *         schema:
 *           type: string
 *         description: Filtrar por semestre
 *     responses:
 *       200:
 *         description: Lista de programación
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
 *                     programacion:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Programacion'
 */
router.get('/', ...requireAuth, (req, res) => programacionController.listar(req, res));

/**
 * @openapi
 * /programacion/semestres:
 *   get:
 *     tags: [Programación]
 *     summary: Listar todos los semestres cargados (solo admin)
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de semestres con metadatos
 */
router.get('/semestres', ...requireAdmin, (req, res) => programacionController.listarSemestres(req, res));

/**
 * @openapi
 * /programacion/semestres/vigente:
 *   get:
 *     tags: [Programación]
 *     summary: Obtener el semestre actualmente vigente
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Semestre vigente
 */
router.get('/semestres/vigente', ...requireAuth, (req, res) => programacionController.listarSemestreVigente(req, res));

router.delete('/semestres/:codigo', ...requireAdmin, (req, res) => programacionController.eliminarSemestre(req, res));

router.patch('/semestres/:codigo/fechas', ...requireAdmin, (req, res) => programacionController.actualizarFechasSemestre(req, res));

/**
 * @openapi
 * /programacion/exportar:
 *   get:
 *     tags: [Programación]
 *     summary: Exportar programación a Excel
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Archivo Excel
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get('/exportar', ...requireAuth, (req, res) => programacionController.exportar(req, res));

/**
 * @openapi
 * /programacion/dia/{dia}:
 *   get:
 *     tags: [Programación]
 *     summary: Listar programación de un día específico
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: dia
 *         required: true
 *         schema:
 *           type: string
 *         description: Día de la semana (ej. lunes, martes)
 *     responses:
 *       200:
 *         description: Programación del día
 */
router.get('/dia/:dia', ...requireAuth, (req, res) => programacionController.listarPorDia(req, res));

/**
 * @openapi
 * /programacion/importar:
 *   post:
 *     tags: [Programación]
 *     summary: Importar programación desde archivo Excel
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [archivo]
 *             properties:
 *               archivo:
 *                 type: string
 *                 format: binary
 *                 description: Archivo Excel (.xlsx) con la programación
 *     responses:
 *       200:
 *         description: Programación importada
 *       400:
 *         description: Archivo inválido o datos incorrectos
 */
router.post('/importar', ...requireAdmin, upload.single('archivo'), (req, res) => programacionController.importar(req, res));

router.patch('/:id', ...requireAdmin, (req, res) => programacionController.actualizarClase(req, res));

module.exports = router;
