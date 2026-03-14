'use strict';
const { Router } = require('express');
const { z } = require('zod');
const llaveController = require('./llave.controller');
const { requireAuth } = require('../auth/auth.middleware');
const { validate } = require('../../shared/middlewares/validate.middleware');

const router = Router();
const ubicacionSchema = z.enum(['oficina_centro_servicios_docentes', 'porteria_superior']);

const entregarSchema = z.object({
  nroidenti: z.string().min(1, 'Documento requerido'),
  profesor: z.string().min(1, 'Profesor requerido'),
  aula: z.string().min(1, 'Aula requerida'),
  hora_inicio: z.string().optional().default(''),
  hora_fin: z.string().optional().default(''),
  dia: z.string().optional().default(''),
  facultad: z.string().optional().default('No especificada'),
  motivo: z.string().optional().default(''),
  ubicacion: ubicacionSchema.optional().default('oficina_centro_servicios_docentes'),
});

const procesarNFCSchema = z.object({
  id_carnet: z.string().min(1, 'id_carnet requerido'),
  ubicacion: ubicacionSchema.optional().default('oficina_centro_servicios_docentes'),
});

const confirmarAnticipadoSchema = z.object({
  id_carnet: z.string().min(1, 'id_carnet requerido'),
  horario: z.string().min(1, 'horario requerido'),
  aula: z.string().min(1, 'aula requerida'),
  rol: z.enum(['docente', 'monitor']).optional().default('docente'),
  documento_persona: z.string().optional().default(''),
  nombre_persona: z.string().optional().default(''),
  ubicacion: ubicacionSchema.optional().default('oficina_centro_servicios_docentes'),
});

router.get('/pendientes', ...requireAuth, (req, res) => llaveController.pendientes(req, res));
router.get('/dia', ...requireAuth, (req, res) => llaveController.pendientesHoy(req, res));
router.get('/historial', ...requireAuth, (req, res) => llaveController.historial(req, res));
router.get('/historial/exportar', ...requireAuth, (req, res) => llaveController.exportarHistorial(req, res));
router.get('/clases-hoy', ...requireAuth, (req, res) => llaveController.clasesProcesadasHoy(req, res));
router.post('/procesar-nfc', ...requireAuth, validate(procesarNFCSchema), (req, res) => llaveController.procesarNFC(req, res));
router.post('/confirmar-anticipado', ...requireAuth, validate(confirmarAnticipadoSchema), (req, res) => llaveController.confirmarAnticipado(req, res));
router.post('/entregar', ...requireAuth, validate(entregarSchema), (req, res) => llaveController.entregar(req, res));
router.post('/devolver/:documento', ...requireAuth, (req, res) => llaveController.devolver(req, res));

module.exports = router;
