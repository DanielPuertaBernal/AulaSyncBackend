'use strict';
const { Router } = require('express');
const multer = require('multer');
const programacionController = require('./programacion.controller');
const { requireAuth, requireAdmin } = require('../auth/auth.middleware');

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

router.get('/', ...requireAuth, (req, res) => programacionController.listar(req, res));
router.get('/exportar', ...requireAdmin, (req, res) => programacionController.exportar(req, res));
router.get('/dia/:dia', ...requireAuth, (req, res) => programacionController.listarPorDia(req, res));
router.post('/importar', ...requireAdmin, upload.single('archivo'), (req, res) => programacionController.importar(req, res));

module.exports = router;
