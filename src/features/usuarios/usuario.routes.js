'use strict';
/**
 * Usuario Routes
 */
const { Router } = require('express');
const { z } = require('zod');
const usuarioController = require('./usuario.controller');
const { requireAdmin, requireAuth, ROLES } = require('../auth/auth.middleware');
const { validate } = require('../../shared/middlewares/validate.middleware');

const router = Router();

const crearUsuarioSchema = z.object({
  usuario: z.string().min(3).max(50),
  nombre: z.string().min(2),
  email: z.string().email(),
  contacto: z.string().optional().default(''),
  password: z.string().min(6),
  rol: z.enum([ROLES.ADMIN, ROLES.AUX]).optional(),
});

const estadoSchema = z.object({
  activo: z.boolean(),
});

const perfilSchema = z.object({
  nombre: z.string().min(2).optional(),
  email: z.string().email().optional(),
  contacto: z.string().optional(),
});

const contrasenaSchema = z.object({
  passwordActual: z.string().min(1),
  passwordNueva: z.string().min(6),
});

// Solo ADMIN puede listar y crear usuarios
router.get('/', ...requireAdmin, (req, res) => usuarioController.listar(req, res));
router.post('/', ...requireAdmin, validate(crearUsuarioSchema), (req, res) => usuarioController.crear(req, res));
router.patch('/:username/estado', ...requireAdmin, validate(estadoSchema), (req, res) => usuarioController.cambiarEstado(req, res));

// Cualquier usuario autenticado puede editar su perfil y contraseña
router.patch('/perfil', ...requireAuth, validate(perfilSchema), (req, res) => usuarioController.editarPerfil(req, res));
router.patch('/contrasena', ...requireAuth, validate(contrasenaSchema), (req, res) => usuarioController.cambiarContrasena(req, res));

module.exports = router;
