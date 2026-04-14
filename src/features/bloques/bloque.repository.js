'use strict';
const { Bloque } = require('./bloque.schema');

class BloqueRepository {
  /** @returns {Promise<object[]>} Bloques ordenados por nombre */
  async findAll() {
    return Bloque.find().sort({ nombre_bloque: 1 }).lean();
  }

  /** @param {string} id @returns {Promise<object|null>} */
  async findById(id) {
    return Bloque.findById(id).lean();
  }

  /** @param {string} nombreBloque @returns {Promise<object|null>} */
  async findByNombre(nombreBloque) {
    return Bloque.findOne({ nombre_bloque: nombreBloque }).lean();
  }

  /** @param {object} data @returns {Promise<object>} */
  async create(data) {
    return (await Bloque.create(data)).toObject();
  }

  /** @param {string} id @param {object} updates @returns {Promise<object|null>} */
  async update(id, updates) {
    return Bloque.findByIdAndUpdate(
      id,
      { $set: { ...updates, fecha_actualizacion: new Date() } },
      { new: true }
    ).lean();
  }

  /** @param {string} id @returns {Promise<object|null>} */
  async deleteById(id) {
    return Bloque.findByIdAndDelete(id).lean();
  }
}

module.exports = new BloqueRepository();
