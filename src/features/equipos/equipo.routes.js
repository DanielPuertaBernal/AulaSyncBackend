'use strict';
const { Router } = require('express');
const { z } = require('zod');
const equipoController = require('./equipo.controller');
const { requireAuth } = require('../auth/auth.middleware');
const { validate } = require('../../shared/middlewares/validate.middleware');

const router = Router();

const crearSchema = z.object({
  nombre: z.string().min(1),
  marca: z.string().optional().default(''),
  consecutivo: z.union([z.string(), z.number()]),
  codigo_inventario: z.string().min(1),
  descripcion: z.string().optional().default(''),
});

const actualizarSchema = z.object({
  nombre: z.string().min(1).optional(),
  marca: z.string().optional(),
  descripcion: z.string().optional(),
  estado: z.enum(['activo', 'inactivo']).optional(),
}).strict();

router.get('/', ...requireAuth, (req, res) => equipoController.listar(req, res));
router.get('/disponibles', ...requireAuth, (req, res) => equipoController.disponibles(req, res));
router.get('/barcode/:codigo', ...requireAuth, (req, res) => equipoController.buscarPorBarcode(req, res));
router.post('/', ...requireAuth, validate(crearSchema), (req, res) => equipoController.crear(req, res));
router.patch('/:id', ...requireAuth, validate(actualizarSchema), (req, res) => equipoController.actualizar(req, res));

module.exports = router;
