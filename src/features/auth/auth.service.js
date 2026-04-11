'use strict';
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const ApiError = require('../../shared/errors/api.error');
const authRepository = require('./auth.repository');
const usuarioRepository = require('../usuarios/usuario.repository');

const SALT_ROUNDS = 12;
const JWT_ISSUER = process.env.JWT_ISSUER || 'aulasync-api';
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'aulasync-clients';
const JWT_MAX_SESSIONS = Math.max(parseInt(process.env.JWT_MAX_SESSIONS || '5', 10), 1);

class AuthService {
  /**
   * Autentica un usuario y retorna tokens JWT
   * @param {string} usuario
   * @param {string} password
   * @param {object} context
   * @returns {Promise<{ok: boolean, mensaje: string, token?: string, refreshToken?: string, usuario?: object}>}
   */
  async login(usuario, password, context = {}) {
    const INVALID_MSG = 'Usuario o contraseña incorrectos';
    const user = await authRepository.findByUsername(usuario);

    if (!user || !user.activo) {
      return { ok: false, mensaje: INVALID_MSG };
    }

    const passwordMatch = await bcrypt.compare(password, user.hash_password);
    if (!passwordMatch) {
      return { ok: false, mensaje: INVALID_MSG };
    }

    const token = this._signAccessToken(user);
    const refreshToken = this._signRefreshToken(user._id.toString());
    await this._persistRefreshSession(user, refreshToken, context);

    // No retornar hash_password ni sesiones
    const { hash_password, sesiones, ...usuarioSafe } = user;

    return {
      ok: true,
      mensaje: `Bienvenido ${user.nombre}`,
      token,
      refreshToken,
      usuario: usuarioSafe,
    };
  }

  /**
   * Verifica un refresh token y emite nuevo access token con rotación de refresh
   * @param {string} refreshToken
   * @param {object} context
   * @returns {Promise<{ok: boolean, token?: string, refreshToken?: string}>}
   */
  async refresh(refreshToken, context = {}) {
    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET, this._getJwtVerifyOptions());
    if (payload.type !== 'refresh') {
      throw ApiError.unauthorized('Tipo de token inválido para refresh');
    }

    const user = await usuarioRepository.findById(payload.sub);
    if (!user || !user.activo) {
      throw ApiError.unauthorized('Usuario no válido');
    }

    const tokenHash = this._hashToken(refreshToken);
    const session = await authRepository.findActiveRefreshSession(payload.sub, tokenHash);
    if (!session) {
      await authRepository.revokeAllRefreshSessions(payload.sub);
      throw ApiError.unauthorized('Refresh token inválido o revocado');
    }

    await authRepository.revokeRefreshSession(payload.sub, tokenHash);

    const newToken = this._signAccessToken(user);
    const newRefreshToken = this._signRefreshToken(user._id.toString());
    await this._persistRefreshSession(user, newRefreshToken, context);

    return { ok: true, token: newToken, refreshToken: newRefreshToken };
  }

  async logout(userId, refreshToken = '') {
    if (!userId) {
      throw ApiError.unauthorized('Usuario no autenticado');
    }

    if (refreshToken) {
      await authRepository.revokeRefreshSession(userId, this._hashToken(refreshToken));
      return { ok: true };
    }

    await authRepository.revokeAllRefreshSessions(userId);
    return { ok: true };
  }

  /**
   * Hashea una contraseña con bcrypt (12 rounds)
   * Mantiene compatibilidad con hashes generados por Python
   * @param {string} password
   * @returns {Promise<string>}
   */
  async hashPassword(password) {
    if (!password || password.length < 6) {
      throw ApiError.badRequest('Contraseña debe tener al menos 6 caracteres');
    }
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  /**
   * Verifica contraseña vs hash almacenado
   * @param {string} password
   * @param {string} hash
   * @returns {Promise<boolean>}
   */
  async verifyPassword(password, hash) {
    return bcrypt.compare(password, hash);
  }

  /**
   * Retorna los datos del usuario actual desde el token
   * @param {string} userId
   * @returns {Promise<object|null>}
   */
  async getMe(userId) {
    const user = await usuarioRepository.findById(userId);
    return this._sanitizeUser(user);
  }

  _signAccessToken(user) {
    const payload = {
      sub: user._id.toString(),
      usuario: user.usuario,
      rol: user.rol,
      nombre: user.nombre,
      type: 'access',
    };

    return jwt.sign(payload, process.env.JWT_SECRET, {
      ...this._getJwtSignOptions(),
      expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    });
  }

  _signRefreshToken(userId) {
    return jwt.sign(
      { sub: userId, type: 'refresh' },
      process.env.JWT_REFRESH_SECRET,
      {
        ...this._getJwtSignOptions(),
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
        jwtid: crypto.randomUUID(),
      }
    );
  }

  _hashToken(token) {
    return crypto.createHash('sha256').update(String(token || '')).digest('hex');
  }

  _resolveRefreshExpiryDate() {
    const raw = String(process.env.JWT_REFRESH_EXPIRES_IN || '7d').trim().toLowerCase();
    const amount = parseInt(raw, 10) || 7;

    if (raw.endsWith('h')) {
      return new Date(Date.now() + (amount * 60 * 60 * 1000));
    }
    return new Date(Date.now() + (amount * 24 * 60 * 60 * 1000));
  }

  async _persistRefreshSession(user, refreshToken, context = {}) {
    await authRepository.addRefreshSession(user._id, {
      token_hash: this._hashToken(refreshToken),
      user_agent: String(context.userAgent || ''),
      ip: String(context.ip || ''),
      created_at: new Date(),
      expires_at: this._resolveRefreshExpiryDate(),
      revoked_at: null,
    }, JWT_MAX_SESSIONS);
  }

  _sanitizeUser(user) {
    if (!user) return null;
    const { hash_password, sesiones, ...usuarioSafe } = user;
    return usuarioSafe;
  }

  _getJwtSignOptions() {
    return {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    };
  }

  _getJwtVerifyOptions() {
    return {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    };
  }
}

module.exports = new AuthService();
