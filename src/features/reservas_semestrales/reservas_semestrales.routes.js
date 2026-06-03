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

// ── Disponibilidad de slots por salón y día ───────────────────────────────────

router.get(
  '/reservas-semestrales/disponibilidad',
  ...requireAuth,
  (req, res) => reservasSemestralesController.disponibilidad(req, res)
);

// ── Validar conflictos de una franja ──────────────────────────────────────────

router.post(
  '/reservas-semestrales/validar',
  ...requireAuth,
  (req, res) => reservasSemestralesController.validar(req, res)
);

// ── Crear reserva semestral manual ────────────────────────────────────────────

router.post(
  '/reservas-semestrales',
  ...requireAuth,
  (req, res) => reservasSemestralesController.crearManual(req, res)
);

// ── Salones disponibles para un día y franja horaria ────────────────────────

router.get(
  '/reservas-semestrales/salones-disponibles',
  ...requireAuth,
  (req, res) => reservasSemestralesController.salonesDisponibles(req, res)
);

// ── Listar todas las reservas semestrales (todos los semestres) ───────────────

router.get(
  '/reservas-semestrales/todas',
  ...requireAuth,
  (req, res) => reservasSemestralesController.listarTodas(req, res)
);

// ── Cancelar grupo de reservas semestrales manuales ───────────────────────────

router.delete(
  '/reservas-semestrales/grupo/:grupo_id',
  ...requireAuth,
  (req, res) => reservasSemestralesController.cancelarGrupo(req, res)
);

// ── Eliminar una reserva semestral individual (o su grupo si tiene grupo_id) ──

router.delete(
  '/reservas-semestrales/:id',
  ...requireAdmin,
  (req, res) => reservasSemestralesController.eliminarIndividual(req, res)
);

// ── Actualizar (reemplazar franjas de) una reserva semestral ──────────────────

router.put(
  '/reservas-semestrales/:id',
  ...requireAdmin,
  (req, res) => reservasSemestralesController.actualizar(req, res)
);

module.exports = router;
