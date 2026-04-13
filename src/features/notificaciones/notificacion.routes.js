'use strict';
const { Router } = require('express');
const { z } = require('zod');
const notificacionController = require('./notificacion.controller');
const { requireAdmin, requireAuth } = require('../auth/auth.middleware');
const { validate } = require('../../shared/middlewares/validate.middleware');

const router = Router();

const destinatarioSchema = z.object({
  nombre: z.string().min(1, 'Nombre requerido'),
  documento: z.string().min(1, 'Documento requerido'),
  correo: z.string().email('Correo inválido'),
  salon: z.string().optional().default(''),
  fecha_prestamo: z.string().min(1, 'Fecha de préstamo requerida'),
  llave_id: z.string().optional().default(''),
});

const enviarNotificacionSchema = z.object({
  destinatarios: z.array(destinatarioSchema).min(1, 'Debe seleccionar al menos un destinatario'),
  tipo_mensaje: z.enum(['predeterminado', 'personalizado']),
  mensaje_personalizado: z.string().optional().default(''),
  asunto: z.string().optional().default(''),
});

router.post(
  '/devolucion-llaves',
  ...requireAuth,
  validate(enviarNotificacionSchema),
  (req, res) => notificacionController.enviarDevolucionLlaves(req, res)
);

router.get(
  '/historial',
  ...requireAuth,
  (req, res) => notificacionController.historial(req, res)
);

module.exports = router;
