'use strict';
const { Router } = require('express');
const { z } = require('zod');
const tipoSilleteriaController = require('./tipo_silleteria.controller');
const { requireAdmin, requireAuth } = require('../auth/auth.middleware');
const { validate } = require('../../shared/middlewares/validate.middleware');

const router = Router();

const schema = z.object({
  nombre: z.string().min(1, 'nombre es requerido'),
});

router.get('/', ...requireAuth, (req, res) => tipoSilleteriaController.listar(req, res));
router.post('/', ...requireAdmin, validate(schema), (req, res) => tipoSilleteriaController.crear(req, res));
router.patch('/:id', ...requireAdmin, validate(schema), (req, res) => tipoSilleteriaController.actualizar(req, res));
router.delete('/:id', ...requireAdmin, (req, res) => tipoSilleteriaController.eliminar(req, res));

module.exports = router;
