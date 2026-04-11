'use strict';
const { Router } = require('express');
const { z } = require('zod');
const ubicacionController = require('./ubicacion.controller');
const { requireAdmin, requireAuth } = require('../auth/auth.middleware');
const { validate } = require('../../shared/middlewares/validate.middleware');

const router = Router();

const crearSchema = z.object({
  clave: z.string().min(2, 'La clave es requerida'),
  nombre: z.string().min(2, 'El nombre es requerido'),
  descripcion: z.string().optional().default(''),
  activa: z.boolean().optional().default(true),
  permite_identificacion: z.boolean().optional().default(false),
  permite_prestamo_llaves: z.boolean().optional().default(false),
  permite_devolucion_llaves: z.boolean().optional().default(false),
  permite_prestamo_equipos: z.boolean().optional().default(false),
});

const actualizarSchema = crearSchema.partial().refine((obj) => Object.keys(obj).length > 0, {
  message: 'Debe enviar al menos un campo para actualizar',
});

router.get('/', ...requireAuth, (req, res) => ubicacionController.listar(req, res));
router.get('/:clave', ...requireAuth, (req, res) => ubicacionController.obtener(req, res));
router.post('/', ...requireAdmin, validate(crearSchema), (req, res) => ubicacionController.crear(req, res));
router.patch('/:id', ...requireAdmin, validate(actualizarSchema), (req, res) => ubicacionController.actualizar(req, res));
router.delete('/:id', ...requireAdmin, (req, res) => ubicacionController.eliminar(req, res));

module.exports = router;
