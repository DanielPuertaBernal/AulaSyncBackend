'use strict';
/**
 * Auth Controller - Orquesta login/logout/me
 */
const authService = require('./auth.service');

class AuthController {
  /**
   * POST /api/auth/login
   */
  async login(req, res) {
    const { usuario, password } = req.body;
    const result = await authService.login(usuario, password, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });

    if (!result.ok) {
      return res.status(401).json({ ok: false, message: result.mensaje });
    }

    return res.status(200).json({
      ok: true,
      message: result.mensaje,
      data: {
        token: result.token,
        refreshToken: result.refreshToken,
        usuario: result.usuario,
      },
    });
  }

  /**
   * POST /api/auth/logout
   * JWT es stateless; el cliente debe eliminar el token.
   * En una implementación con blacklist se agregaría aquí.
   */
  async logout(req, res) {
    await authService.logout(req.user?.sub, req.body?.refreshToken || '');
    return res.status(200).json({ ok: true, message: 'Sesión cerrada correctamente' });
  }

  /**
   * GET /api/auth/me
   * Retorna el usuario autenticado (desde el token)
   */
  async me(req, res) {
    const usuario = await authService.getMe(req.user.sub);
    if (!usuario) {
      return res.status(404).json({ ok: false, message: 'Usuario no encontrado' });
    }
    return res.status(200).json({ ok: true, data: { usuario } });
  }

  /**
   * POST /api/auth/refresh
   */
  async refresh(req, res) {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ ok: false, message: 'refreshToken requerido' });
    }
    const result = await authService.refresh(refreshToken, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });
    return res.status(200).json({ ok: true, data: { token: result.token, refreshToken: result.refreshToken } });
  }
}

module.exports = new AuthController();
