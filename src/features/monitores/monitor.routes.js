'use strict';
const { Router } = require('express');
const { z } = require('zod');
const monitorController = require('./monitor.controller');
const { requireAuth } = require('../auth/auth.middleware');
const { validate } = require('../../shared/middlewares/validate.middleware');

const router = Router();

const registrarSchema = z.object({
  numero_documento_docente: z.string().min(1, 'Documento del docente requerido'),
  numero_documento_monitor: z.string().min(1, 'Documento del monitor requerido'),
  materia: z.string().min(1, 'Materia requerida'),
  aula: z.string().optional().default(''),
  horario: z.string().optional().default(''),
  dia: z.string().optional().default(''),
});

router.get('/', ...requireAuth, (req, res) => monitorController.listar(req, res));
router.get('/clases/:documento', ...requireAuth, (req, res) => monitorController.clasesDocente(req, res));
router.post('/', ...requireAuth, validate(registrarSchema), (req, res) => monitorController.registrar(req, res));
router.delete('/:id', ...requireAuth, (req, res) => monitorController.eliminar(req, res));

module.exports = router;
