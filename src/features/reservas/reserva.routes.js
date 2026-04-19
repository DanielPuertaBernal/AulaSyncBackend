'use strict';
const { Router } = require('express');
const { z } = require('zod');
const reservaController = require('./reserva.controller');
const { requireAdmin, requireAuth } = require('../auth/auth.middleware');
const { validate } = require('../../shared/middlewares/validate.middleware');

const router = Router();

const crearReservaSchema = z.object({
  solicitante_documento: z.string().min(1, 'Documento requerido'),
  solicitante_nombre: z.string().min(1, 'Nombre requerido'),
  nombre_bloque: z.string().min(1, 'Bloque requerido'),
  nombre_salon: z.string().min(1, 'Salón requerido'),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha debe ser YYYY-MM-DD'),
  hora_inicio: z.string().regex(/^\d{2}:\d{2}$/, 'Hora debe ser HH:MM'),
  hora_fin: z.string().regex(/^\d{2}:\d{2}$/, 'Hora debe ser HH:MM'),
  motivo: z.string().max(500).optional().default(''),
});

const validarReservaSchema = z.object({
  nombre_salon: z.string().min(1),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hora_inicio: z.string().regex(/^\d{2}:\d{2}$/),
  hora_fin: z.string().regex(/^\d{2}:\d{2}$/),
});

router.post(
  '/validar',
  ...requireAuth,
  validate(validarReservaSchema),
  (req, res) => reservaController.validar(req, res)
);

router.post(
  '/',
  ...requireAuth,
  validate(crearReservaSchema),
  (req, res) => reservaController.crear(req, res)
);

router.get(
  '/',
  ...requireAuth,
  (req, res) => reservaController.listar(req, res)
);

router.get(
  '/disponibilidad',
  ...requireAuth,
  (req, res) => reservaController.disponibilidad(req, res)
);

router.post(
  '/:id/aprobar',
  ...requireAdmin,
  (req, res) => reservaController.aprobar(req, res)
);

router.post(
  '/:id/rechazar',
  ...requireAdmin,
  (req, res) => reservaController.rechazar(req, res)
);

router.post(
  '/:id/cancelar',
  ...requireAuth,
  (req, res) => reservaController.cancelar(req, res)
);

module.exports = router;
