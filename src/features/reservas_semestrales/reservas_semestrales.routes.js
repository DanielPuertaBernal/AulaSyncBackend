'use strict';
const { Router } = require('express');
const multer = require('multer');
const reservasSemestralesController = require('./reservas_semestrales.controller');
const { requireAuth, requireAdmin } = require('../auth/auth.middleware');

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// ── Rutas bajo /programacion/semestres/:codigo/reservas-semestrales ──────────

router.get(
  '/semestres/:codigo/reservas-semestrales',
  ...requireAuth,
  (req, res) => reservasSemestralesController.listar(req, res)
);

router.post(
  '/semestres/:codigo/reservas-semestrales/importar',
  ...requireAdmin,
  upload.single('file'),
  (req, res) => reservasSemestralesController.importar(req, res)
);

router.delete(
  '/semestres/:codigo/reservas-semestrales',
  ...requireAdmin,
  (req, res) => reservasSemestralesController.eliminar(req, res)
);

router.get(
  '/semestres/:codigo/reservas-semestrales/exportar',
  ...requireAuth,
  (req, res) => reservasSemestralesController.exportar(req, res)
);

// ── Ruta global por día (usada por auxiliar y NFC) ───────────────────────────

router.get(
  '/reservas-semestrales/dia/:dia',
  ...requireAuth,
  (req, res) => reservasSemestralesController.listarPorDia(req, res)
);

module.exports = router;
