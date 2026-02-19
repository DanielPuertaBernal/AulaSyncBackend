'use strict';
/**
 * Auth Repository - Abstracción MongoDB para usuarios (auth)
 * Equivale a infrastructure/repositories/usuario_mongo_repository.py
 */
const { Usuario } = require('./auth.schema');

class AuthRepository {
  /**
   * Busca usuario por nombre de usuario, incluyendo hash_password
   * @param {string} username
   * @returns {Promise<object|null>}
   */
  async findByUsername(username) {
    return Usuario.findOne({ usuario: username }).select('+hash_password').lean();
  }

  /**
   * Busca usuario por ID
   * @param {string} id
   * @returns {Promise<object|null>}
   */
  async findById(id) {
    return Usuario.findById(id).lean();
  }

  /**
   * Busca usuario por email
   * @param {string} email
   * @returns {Promise<object|null>}
   */
  async findByEmail(email) {
    return Usuario.findOne({ email: email.toLowerCase() }).lean();
  }
}

module.exports = new AuthRepository();
