'use strict';
const { Usuario } = require('./auth.schema');

class AuthRepository {
  async findByUsername(username) {
    return Usuario.findOne({ usuario: username }).select('+hash_password').lean();
  }
}

module.exports = new AuthRepository();
