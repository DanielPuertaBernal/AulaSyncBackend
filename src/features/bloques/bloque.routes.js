'use strict';
const { Router } = require('express');
const { z } = require('zod');
const bloqueController = require('./bloque.controller');
const { requireAdmin } = require('../auth/auth.middleware');
const { validate } = require('../../shared/middlewares/validate.middleware');

const router = Router();

const crearSchema = z.object({
  nombre_bloque: z.string().min(1, 'nombre_bloque es requerido'),
});

const actualizarSchema = z.object({
  nombre_bloque: z.string().min(1, 'nombre_bloque es requerido'),
});

router.get('/', ...requireAdmin, (req, res) => bloqueController.listar(req, res));
router.post('/', ...requireAdmin, validate(crearSchema), (req, res) => bloqueController.crear(req, res));
router.patch('/:id', ...requireAdmin, validate(actualizarSchema), (req, res) => bloqueController.actualizar(req, res));
router.delete('/:id', ...requireAdmin, (req, res) => bloqueController.eliminar(req, res));

module.exports = router;
