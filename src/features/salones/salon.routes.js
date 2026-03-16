'use strict';
const { Router } = require('express');
const { z } = require('zod');
const salonController = require('./salon.controller');
const { requireAdmin, requireAuth } = require('../auth/auth.middleware');
const { validate } = require('../../shared/middlewares/validate.middleware');

const router = Router();

const capacidadSchema = z.preprocess(
  (v) => Number(v),
  z.number().int().min(1, 'capacidad_estudiantes debe ser mayor a 0')
);

const crearSchema = z.object({
  nombre_salon: z.string().min(1, 'nombre_salon es requerido'),
  nombre_bloque: z.string().min(1, 'nombre_bloque es requerido'),
  capacidad_estudiantes: capacidadSchema,
  tipo_silleteria: z.string().min(1, 'tipo_silleteria es requerido'),
});

const actualizarSchema = z.object({
  nombre_salon: z.string().min(1).optional(),
  nombre_bloque: z.string().min(1).optional(),
  capacidad_estudiantes: capacidadSchema.optional(),
  tipo_silleteria: z.string().min(1).optional(),
}).strict().refine((obj) => Object.keys(obj).length > 0, {
  message: 'Debe enviar al menos un campo para actualizar',
});

router.get('/', ...requireAuth, (req, res) => salonController.listar(req, res));
router.post('/', ...requireAdmin, validate(crearSchema), (req, res) => salonController.crear(req, res));
router.patch('/:id', ...requireAdmin, validate(actualizarSchema), (req, res) => salonController.actualizar(req, res));
router.delete('/:id', ...requireAdmin, (req, res) => salonController.eliminar(req, res));

module.exports = router;
