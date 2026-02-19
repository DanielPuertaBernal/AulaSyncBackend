'use strict';
const { Router } = require('express');
const multer = require('multer');
const docenteController = require('./docente.controller');
const { requireAuth, requireAdmin } = require('../auth/auth.middleware');

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.get('/', ...requireAuth, (req, res) => docenteController.listar(req, res));
router.get('/carnet/:idCarnet', ...requireAuth, (req, res) => docenteController.obtenerPorCarnet(req, res));
router.get('/:documento', ...requireAuth, (req, res) => docenteController.obtener(req, res));
router.post('/importar', ...requireAdmin, upload.single('archivo'), (req, res) => docenteController.importar(req, res));

module.exports = router;
