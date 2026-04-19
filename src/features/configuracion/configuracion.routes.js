'use strict';
const { Router } = require('express');
const { z } = require('zod');
const configuracionController = require('./configuracion.controller');
const { requireAdmin, requireAuth } = require('../auth/auth.middleware');
const { validate } = require('../../shared/middlewares/validate.middleware');

const router = Router();

const guardarSchema = z.object({
  tiempo_maximo_prestamo_minutos: z.number().min(5).max(1440).optional(),
  intervalo_recordatorio_minutos: z.number().min(5).max(1440).optional(),
  max_recordatorios: z.number().min(1).max(20).optional(),
  notificaciones_activas: z.boolean().optional(),
});

router.get('/', ...requireAuth, (req, res) => configuracionController.listar(req, res));
router.get('/defaults', ...requireAuth, (req, res) => configuracionController.defaults(req, res));
router.get('/:bloque', ...requireAuth, (req, res) => configuracionController.obtener(req, res));
router.put('/:bloque', ...requireAdmin, validate(guardarSchema), (req, res) => configuracionController.guardar(req, res));
router.delete('/:bloque', ...requireAdmin, (req, res) => configuracionController.eliminar(req, res));

module.exports = router;
