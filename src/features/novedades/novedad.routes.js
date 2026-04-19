'use strict';
const { Router } = require('express');
const { z } = require('zod');
const novedadController = require('./novedad.controller');
const { requireAdmin, requireAuth } = require('../auth/auth.middleware');
const { validate } = require('../../shared/middlewares/validate.middleware');

const router = Router();

const registrarNovedadSchema = z.object({
  tipo_recurso: z.enum(['llave', 'equipo']),
  recurso_id: z.string().optional().default(''),
  prestamo_ref: z.string().optional().default(''),
  reportado_por: z.string().optional().default(''),
  reportado_por_nombre: z.string().optional().default(''),
  salon: z.string().optional().default(''),
  categoria: z.enum(['sin_novedad', 'daño_fisico', 'no_funciona', 'perdida', 'otro']),
  descripcion: z.string().max(500).optional().default(''),
});

const actualizarEstadoSchema = z.object({
  estado: z.enum(['abierta', 'en_revision', 'resuelta', 'cerrada']),
  resolucion: z.string().max(500).optional(),
});

router.post(
  '/',
  ...requireAuth,
  validate(registrarNovedadSchema),
  (req, res) => novedadController.registrar(req, res)
);

router.get(
  '/',
  ...requireAuth,
  (req, res) => novedadController.listar(req, res)
);

router.get(
  '/estadisticas',
  ...requireAdmin,
  (req, res) => novedadController.estadisticas(req, res)
);

router.get(
  '/:id',
  ...requireAuth,
  (req, res) => novedadController.obtener(req, res)
);

router.patch(
  '/:id/estado',
  ...requireAdmin,
  validate(actualizarEstadoSchema),
  (req, res) => novedadController.actualizarEstado(req, res)
);

module.exports = router;
