'use strict';
/**
 * Usuario Repository - CRUD completo de usuarios
 * Equivale a infrastructure/repositories/usuario_mongo_repository.py
 */
const { Usuario } = require('./usuario.schema');

class UsuarioRepository {
  /**
   * Lista todos los usuarios (sin hash_password)
   * @returns {Promise<object[]>}
   */
  async findAll() {
    return Usuario.find().lean();
  }

  /**
   * Busca por nombre de usuario
   * @param {string} username
   * @returns {Promise<object|null>}
   */
  async findByUsername(username) {
    return Usuario.findOne({ usuario: username }).lean();
  }

  /**
   * Busca por ID
   * @param {string} id
   * @returns {Promise<object|null>}
   */
  async findById(id) {
    return Usuario.findById(id).lean();
  }

  /**
   * Busca por email
   * @param {string} email
   * @returns {Promise<object|null>}
   */
  async findByEmail(email) {
    return Usuario.findOne({ email: email.toLowerCase() }).lean();
  }

  /**
   * Crea un nuevo usuario
   * @param {object} data
   * @returns {Promise<object>}
   */
  async create(data) {
    const user = await Usuario.create(data);
    const { hash_password, ...safe } = user.toObject();
    return safe;
  }

  /**
   * Actualiza campos de un usuario
   * @param {string} username
   * @param {object} updates
   * @returns {Promise<object|null>}
   */
  async updateByUsername(username, updates) {
    const user = await Usuario.findOneAndUpdate(
      { usuario: username },
      { $set: updates },
      { new: true }
    ).lean();
    if (!user) return null;
    const { hash_password, ...safe } = user;
    return safe;
  }

  /**
   * Activa o desactiva un usuario (soft delete)
   * @param {string} username
   * @param {boolean} activo
   * @returns {Promise<object|null>}
   */
  async setActivo(username, activo) {
    return this.updateByUsername(username, { activo });
  }

  /**
   * Actualiza el hash de contraseña
   * @param {string} username
   * @param {string} hashPassword
   * @returns {Promise<boolean>}
   */
  async updatePassword(username, hashPassword) {
    const result = await Usuario.updateOne(
      { usuario: username },
      { $set: { hash_password: hashPassword } }
    );
    return result.modifiedCount > 0;
  }

  /**
   * Verifica si existe un usuario por username o email
   * @param {string} username
   * @param {string} email
   * @returns {Promise<{usuarioExiste: boolean, emailExiste: boolean}>}
   */
  async checkDuplicates(username, email) {
    const [byUsername, byEmail] = await Promise.all([
      Usuario.exists({ usuario: username }),
      Usuario.exists({ email: email.toLowerCase() }),
    ]);
    return { usuarioExiste: !!byUsername, emailExiste: !!byEmail };
  }
}

module.exports = new UsuarioRepository();
