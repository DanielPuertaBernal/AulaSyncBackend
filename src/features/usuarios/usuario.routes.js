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
  numero_documento: z.string().optional().default(''),
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

/**
 * @openapi
 * /usuarios:
 *   get:
 *     tags: [Usuarios]
 *     summary: Listar usuarios
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de usuarios
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     usuarios:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Usuario'
 *       401:
 *         $ref: '#/components/schemas/ErrorNoAutenticado'
 *       403:
 *         $ref: '#/components/schemas/ErrorNoAutorizado'
 */
router.get('/', ...requireAdmin, (req, res) => usuarioController.listar(req, res));

/**
 * @openapi
 * /usuarios:
 *   post:
 *     tags: [Usuarios]
 *     summary: Crear usuario
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CrearUsuarioRequest'
 *     responses:
 *       201:
 *         description: Usuario creado
 *       400:
 *         description: Datos inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorValidacion'
 *       403:
 *         $ref: '#/components/schemas/ErrorNoAutorizado'
 */
router.post('/', ...requireAdmin, validate(crearUsuarioSchema), (req, res) => usuarioController.crear(req, res));

/**
 * @openapi
 * /usuarios/{username}/estado:
 *   patch:
 *     tags: [Usuarios]
 *     summary: Cambiar estado (activo/inactivo)
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: username
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [activo]
 *             properties:
 *               activo:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Estado actualizado
 *       403:
 *         $ref: '#/components/schemas/ErrorNoAutorizado'
 *       404:
 *         $ref: '#/components/schemas/ErrorNoEncontrado'
 */
router.patch('/:username/estado', ...requireAdmin, validate(estadoSchema), (req, res) => usuarioController.cambiarEstado(req, res));

/**
 * @openapi
 * /usuarios/perfil:
 *   patch:
 *     tags: [Usuarios]
 *     summary: Editar perfil propio
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ActualizarPerfilRequest'
 *     responses:
 *       200:
 *         description: Perfil actualizado
 *       400:
 *         description: Datos inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorValidacion'
 */
router.patch('/perfil', ...requireAuth, validate(perfilSchema), (req, res) => usuarioController.editarPerfil(req, res));

/**
 * @openapi
 * /usuarios/contrasena:
 *   patch:
 *     tags: [Usuarios]
 *     summary: Cambiar contraseña propia
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CambiarContrasenaRequest'
 *     responses:
 *       200:
 *         description: Contraseña actualizada
 *       400:
 *         description: Contraseña actual incorrecta
 */
router.patch('/contrasena', ...requireAuth, validate(contrasenaSchema), (req, res) => usuarioController.cambiarContrasena(req, res));

const vinculacionSchema = z.object({
  numero_documento: z.string().trim(),
});

router.patch('/:username/vinculacion', ...requireAdmin, validate(vinculacionSchema), (req, res) => usuarioController.vincularComunidad(req, res));

module.exports = router;
