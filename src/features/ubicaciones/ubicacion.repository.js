'use strict';
const { Ubicacion } = require('./ubicacion.schema');

class UbicacionRepository {
  /** @param {{soloActivas?: boolean}} options @returns {Promise<object[]>} */
  async findAll({ soloActivas = true } = {}) {
    const filter = soloActivas ? { activa: true } : {};
    return Ubicacion.find(filter).sort({ nombre: 1 }).lean();
  }

  /** @param {string} id @returns {Promise<object|null>} */
  async findById(id) {
    return Ubicacion.findById(id).lean();
  }

  /** @param {string} clave @returns {Promise<object|null>} */
  async findByClave(clave) {
    return Ubicacion.findOne({ clave }).lean();
  }

  /** @param {object} data @returns {Promise<object>} */
  async create(data) {
    return (await Ubicacion.create(data)).toObject();
  }

  /** @param {string} id @param {object} updates @returns {Promise<object|null>} */
  async update(id, updates) {
    return Ubicacion.findByIdAndUpdate(
      id,
      { $set: { ...updates, fecha_actualizacion: new Date() } },
      { new: true }
    ).lean();
  }

  /** @param {string} id @returns {Promise<object|null>} */
  async deleteById(id) {
    return Ubicacion.findByIdAndDelete(id).lean();
  }

  /** @param {object[]} items - Ubicaciones por defecto a insertar @returns {Promise<void>} */
  async upsertDefaults(items = []) {
    if (!items.length) return;

    await Promise.all(items.map((item) => Ubicacion.updateOne(
      { clave: item.clave },
      {
        $setOnInsert: {
          ...item,
          fecha_creacion: new Date(),
          fecha_actualizacion: null,
        },
      },
      { upsert: true }
    )));
  }
}

module.exports = new UbicacionRepository();
