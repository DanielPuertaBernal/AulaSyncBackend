'use strict';
const { Router } = require('express');
const { z } = require('zod');
const salonController = require('./salon.controller');
const { requireAdmin, requireAuth } = require('../auth/auth.middleware');
const { validate } = require('../../shared/middlewares/validate.middleware');

const router = Router();

const capacidadSchema = z.preprocess(
  (v) => Number(v),
  z.number().int().min(1, 'capacidad_estudiantes debe ser mayor a 0')
);

const crearSchema = z.object({
  nombre_salon: z.string().min(1, 'nombre_salon es requerido'),
  nombre_bloque: z.string().min(1, 'nombre_bloque es requerido'),
  capacidad_estudiantes: capacidadSchema,
  tipo_silleteria: z.string().min(1, 'tipo_silleteria es requerido'),
});

const actualizarSchema = z.object({
  nombre_salon: z.string().min(1).optional(),
  nombre_bloque: z.string().min(1).optional(),
  capacidad_estudiantes: capacidadSchema.optional(),
  tipo_silleteria: z.string().min(1).optional(),
}).strict().refine((obj) => Object.keys(obj).length > 0, {
  message: 'Debe enviar al menos un campo para actualizar',
});

/**
 * @openapi
 * /salones:
 *   get:
 *     tags: [Salones]
 *     summary: Listar salones
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de salones
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
 *                     salones:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Salon'
 */
router.get('/', ...requireAuth, (req, res) => salonController.listar(req, res));

/**
 * @openapi
 * /salones:
 *   post:
 *     tags: [Salones]
 *     summary: Crear salón
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CrearSalonRequest'
 *     responses:
 *       201:
 *         description: Salón creado
 *       400:
 *         description: Datos inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorValidacion'
 */
router.post('/', ...requireAdmin, validate(crearSchema), (req, res) => salonController.crear(req, res));

/**
 * @openapi
 * /salones/{id}:
 *   patch:
 *     tags: [Salones]
 *     summary: Actualizar salón
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CrearSalonRequest'
 *     responses:
 *       200:
 *         description: Salón actualizado
 *       404:
 *         $ref: '#/components/schemas/ErrorNoEncontrado'
 */
router.patch('/:id', ...requireAdmin, validate(actualizarSchema), (req, res) => salonController.actualizar(req, res));

/**
 * @openapi
 * /salones/{id}:
 *   delete:
 *     tags: [Salones]
 *     summary: Eliminar salón
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Salón eliminado
 *       404:
 *         $ref: '#/components/schemas/ErrorNoEncontrado'
 */
router.delete('/:id', ...requireAdmin, (req, res) => salonController.eliminar(req, res));

module.exports = router;
