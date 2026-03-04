'use strict';
const { Router } = require('express');
const { z } = require('zod');
const authController = require('./auth.controller');
const { verifyToken } = require('./auth.middleware');
const { validate } = require('../../shared/middlewares/validate.middleware');
const { authLimiter, refreshLimiter } = require('../../shared/middlewares/rate.limiter');

const router = Router();

const loginSchema = z.object({
  usuario: z.string().min(1, 'Usuario requerido'),
  password: z.string().min(1, 'Contraseña requerida'),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'refreshToken requerido'),
});

router.post('/login', authLimiter, validate(loginSchema), (req, res) => authController.login(req, res));
router.post('/logout', verifyToken, (req, res) => authController.logout(req, res));
router.get('/me', verifyToken, (req, res) => authController.me(req, res));
router.post('/refresh', refreshLimiter, validate(refreshSchema), (req, res) => authController.refresh(req, res));

module.exports = router;
