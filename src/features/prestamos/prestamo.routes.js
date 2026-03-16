'use strict';
const { Router } = require('express');
const { z } = require('zod');
const prestamoController = require('./prestamo.controller');
const { requireAuth } = require('../auth/auth.middleware');
const { validate } = require('../../shared/middlewares/validate.middleware');

const router = Router();
const ubicacionOficinaSchema = z.enum(['oficina_centro_servicios_docentes']);

const crearSchema = z.object({
  docente_codigo_nfc: z.string().min(1),
  docente_nombre: z.string().min(1),
  equipos: z.array(z.union([z.string(), z.record(z.any())])).min(1),
  auxiliar_prestamista: z.string().optional(),
  ubicacion_prestamo: ubicacionOficinaSchema.optional().default('oficina_centro_servicios_docentes'),
});

const devolucionSchema = z.object({
  prestamo_id: z.string().min(1),
  docente_codigo_nfc: z.string().optional().default(''),
  docente_nombre: z.string().optional().default(''),
  equipos: z.array(z.union([z.string(), z.record(z.any())])).optional().default([]),
  auxiliar_que_recibio: z.string().optional(),
  ubicacion_devolucion: ubicacionOficinaSchema.optional().default('oficina_centro_servicios_docentes'),
});

router.get('/', ...requireAuth, (req, res) => prestamoController.listar(req, res));
router.get('/activos', ...requireAuth, (req, res) => prestamoController.activos(req, res));
router.get('/docente/:nfc', ...requireAuth, (req, res) => prestamoController.porDocente(req, res));
router.post('/', ...requireAuth, validate(crearSchema), (req, res) => prestamoController.crear(req, res));
router.post('/:id/equipos', ...requireAuth, (req, res) => prestamoController.agregarEquipo(req, res));
router.post('/devolucion', ...requireAuth, validate(devolucionSchema), (req, res) => prestamoController.devolucion(req, res));

module.exports = router;
