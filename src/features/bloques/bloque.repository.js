'use strict';
const BaseRepository = require('../../shared/db/base.repository');
const { Bloque } = require('./bloque.schema');

class BloqueRepository extends BaseRepository {
  constructor() { super(Bloque); }

  /** @returns {Promise<object[]>} Bloques ordenados por nombre */
  async findAll() {
    return this.Model.find().sort({ nombre_bloque: 1 }).lean();
  }

  /** @param {string} nombreBloque @returns {Promise<object|null>} */
  async findByNombre(nombreBloque) {
    return this.Model.findOne({ nombre_bloque: nombreBloque }).lean();
  }
}

module.exports = new BloqueRepository();
