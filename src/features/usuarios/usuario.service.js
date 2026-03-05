'use strict';
/**
 * Usuario Service - Gestión de usuarios del sistema
 * Equivale a application/services/auth_service.py (sección gestión de usuarios)
 */
const usuarioRepository = require('./usuario.repository');
const authRepository = require('../auth/auth.repository');
const authService = require('../auth/auth.service');
const { ROLES } = require('./usuario.schema');

class UsuarioService {
  /**
   * Lista todos los usuarios activos e inactivos
   * Solo ADMIN_PROG puede ver esto
   * @returns {Promise<object[]>}
   */
  async listarUsuarios() {
    return usuarioRepository.findAll();
  }

  /**
   * Crea un nuevo usuario auxiliar
   * Solo ADMIN_PROG puede crear usuarios
   * @param {object} data
   * @param {string} data.usuario
   * @param {string} data.nombre
   * @param {string} data.email
   * @param {string} data.contacto
   * @param {string} data.password
   * @param {string} [data.rol] - Default: AUX_PROG
   * @returns {Promise<object>}
   */
  async crearUsuario({ usuario, nombre, email, contacto, password, rol }) {
    // Verificar duplicados
    const { usuarioExiste, emailExiste } = await usuarioRepository.checkDuplicates(usuario, email);
    if (usuarioExiste) {
      throw Object.assign(new Error(`El usuario '${usuario}' ya existe`), { statusCode: 409 });
    }
    if (emailExiste) {
      throw Object.assign(new Error(`El email '${email}' ya está registrado`), { statusCode: 409 });
    }

    const hashPassword = await authService.hashPassword(password);

    return usuarioRepository.create({
      usuario,
      nombre: nombre.trim(),
      email: email.toLowerCase().trim(),
      contacto: contacto || '',
      rol: rol || ROLES.AUX,
      hash_password: hashPassword,
      activo: true,
    });
  }

  /**
   * Activa o desactiva un usuario
   * @param {string} username
   * @param {boolean} activo
   * @param {string} usuarioActual - Usuario que hace la acción
   * @returns {Promise<object>}
   */
  async cambiarEstado(username, activo, usuarioActual) {
    if (username === usuarioActual) {
      throw Object.assign(new Error('No puedes desactivarte a ti mismo'), { statusCode: 400 });
    }
    const updated = await usuarioRepository.setActivo(username, activo);
    if (!updated) {
      throw Object.assign(new Error(`Usuario '${username}' no encontrado`), { statusCode: 404 });
    }
    return updated;
  }

  /**
   * Edita el perfil propio (nombre, email, contacto)
   * @param {string} username
   * @param {object} data
   * @returns {Promise<object>}
   */
  async editarPerfil(username, { nombre, email, contacto }) {
    const updates = {};
    if (nombre) updates.nombre = nombre.trim();
    if (email) {
      // Verificar que el email no esté en uso por otro usuario
      const existing = await usuarioRepository.findByEmail(email);
      if (existing && existing.usuario !== username) {
        throw Object.assign(new Error('El email ya está en uso'), { statusCode: 409 });
      }
      updates.email = email.toLowerCase().trim();
    }
    if (contacto !== undefined) updates.contacto = contacto;

    const updated = await usuarioRepository.updateByUsername(username, updates);
    if (!updated) {
      throw Object.assign(new Error('Usuario no encontrado'), { statusCode: 404 });
    }
    return updated;
  }

  /**
   * Cambia la contraseña del usuario actual
   * @param {string} username
   * @param {string} passwordActual
   * @param {string} passwordNueva
   * @returns {Promise<boolean>}
   */
  async cambiarContrasena(username, passwordActual, passwordNueva) {
    const user = await authRepository.findByUsername(username);
    if (!user) {
      throw Object.assign(new Error('Usuario no encontrado'), { statusCode: 404 });
    }

    const match = await authService.verifyPassword(passwordActual, user.hash_password);
    if (!match) {
      throw Object.assign(new Error('Contraseña actual incorrecta'), { statusCode: 401 });
    }

    const newHash = await authService.hashPassword(passwordNueva);
    await usuarioRepository.updatePassword(username, newHash);
    return true;
  }

  /**
   * Obtiene un usuario por username
   * @param {string} username
   * @returns {Promise<object>}
   */
  async obtenerUsuario(username) {
    const user = await usuarioRepository.findByUsername(username);
    if (!user) {
      throw Object.assign(new Error(`Usuario '${username}' no encontrado`), { statusCode: 404 });
    }
    return user;
  }
}

module.exports = new UsuarioService();
