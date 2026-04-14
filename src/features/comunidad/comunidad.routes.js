'use strict';
const { Router } = require('express');
const comunidadController = require('./comunidad.controller');
const { requireAuth } = require('../auth/auth.middleware');

const router = Router();

router.get('/', ...requireAuth, (req, res) => comunidadController.listar(req, res));
router.get('/carnet/:idCarnet', ...requireAuth, (req, res) => comunidadController.obtenerPorCarnet(req, res));
router.get('/:documento', ...requireAuth, (req, res) => comunidadController.obtener(req, res));

// Endpoint de sincronización — sin autenticación (sistema externo)
router.post('/sync', (req, res) => comunidadController.sync(req, res));

module.exports = router;
