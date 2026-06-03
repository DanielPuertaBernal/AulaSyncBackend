'use strict';

/**
 * Repositorio base con operaciones CRUD estándar sobre un modelo Mongoose.
 * Las subclases reciben el Model en el constructor y pueden sobreescribir
 * cualquier método o agregar los suyos propios.
 */
class BaseRepository {
  /** @param {import('mongoose').Model} Model */
  constructor(Model) {
    this.Model = Model;
  }

  /** @param {string} id @returns {Promise<object|null>} */
  async findById(id) {
    return this.Model.findById(id).lean();
  }

  /** @param {object} data @returns {Promise<object>} */
  async create(data) {
    return (await this.Model.create(data)).toObject();
  }

  /**
   * Actualiza un documento por id. Siempre estampa fecha_actualizacion.
   * @param {string} id @param {object} updates @returns {Promise<object|null>}
   */
  async update(id, updates) {
    return this.Model.findByIdAndUpdate(
      id,
      { $set: { ...updates, fecha_actualizacion: new Date() } },
      { new: true }
    ).lean();
  }

  /** @param {string} id @returns {Promise<object|null>} */
  async deleteById(id) {
    return this.Model.findByIdAndDelete(id).lean();
  }
}

module.exports = BaseRepository;
