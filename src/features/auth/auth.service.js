'use strict';
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const authRepository = require('./auth.repository');
const usuarioRepository = require('../usuarios/usuario.repository');

const SALT_ROUNDS = 12;

class AuthService {
  /**
   * Autentica un usuario y retorna tokens JWT
   * @param {string} usuario
   * @param {string} password
   * @returns {Promise<{ok: boolean, mensaje: string, token?: string, refreshToken?: string, usuario?: object}>}
   */
  async login(usuario, password) {
    const INVALID_MSG = 'Usuario o contraseña incorrectos';
    const user = await authRepository.findByUsername(usuario);

    if (!user) {
      return { ok: false, mensaje: INVALID_MSG };
    }
    if (!user.activo) {
      return { ok: false, mensaje: INVALID_MSG };
    }

    const passwordMatch = await bcrypt.compare(password, user.hash_password);
    if (!passwordMatch) {
      return { ok: false, mensaje: INVALID_MSG };
    }

    const payload = {
      sub: user._id.toString(),
      usuario: user.usuario,
      rol: user.rol,
      nombre: user.nombre,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    });
    const refreshToken = jwt.sign(
      { sub: user._id.toString() },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
    );

    // No retornar hash_password
    const { hash_password, ...usuarioSafe } = user;

    return {
      ok: true,
      mensaje: `Bienvenido ${user.nombre}`,
      token,
      refreshToken,
      usuario: usuarioSafe,
    };
  }

  /**
   * Verifica un refresh token y emite nuevo access token
   * @param {string} refreshToken
   * @returns {Promise<{ok: boolean, token?: string}>}
   */
  async refresh(refreshToken) {
    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await usuarioRepository.findById(payload.sub);
    if (!user || !user.activo) {
      throw Object.assign(new Error('Usuario no válido'), { statusCode: 401 });
    }

    const newToken = jwt.sign(
      { sub: user._id.toString(), usuario: user.usuario, rol: user.rol, nombre: user.nombre },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    return { ok: true, token: newToken };
  }

  /**
   * Hashea una contraseña con bcrypt (12 rounds)
   * Mantiene compatibilidad con hashes generados por Python
   * @param {string} password
   * @returns {Promise<string>}
   */
  async hashPassword(password) {
    if (!password || password.length < 6) {
      throw Object.assign(new Error('Contraseña debe tener al menos 6 caracteres'), { statusCode: 400 });
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
    return usuarioRepository.findById(userId);
  }
}

module.exports = new AuthService();
