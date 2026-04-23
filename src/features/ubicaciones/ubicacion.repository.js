'use strict';
const BaseRepository = require('../../shared/db/base.repository');
const { Ubicacion } = require('./ubicacion.schema');

class UbicacionRepository extends BaseRepository {
  constructor() { super(Ubicacion); }

  /** @param {{soloActivas?: boolean}} options @returns {Promise<object[]>} */
  async findAll({ soloActivas = true } = {}) {
    const filter = soloActivas ? { activa: true } : {};
    return this.Model.find(filter).sort({ nombre: 1 }).lean();
  }

  /** @param {string} clave @returns {Promise<object|null>} */
  async findByClave(clave) {
    return this.Model.findOne({ clave }).lean();
  }

  /** @param {object[]} items - Ubicaciones por defecto a insertar @returns {Promise<void>} */
  async upsertDefaults(items = []) {
    if (!items.length) return;
    await Promise.all(items.map((item) => this.Model.updateOne(
      { clave: item.clave },
      { $setOnInsert: { ...item, fecha_creacion: new Date(), fecha_actualizacion: null } },
      { upsert: true }
    )));
  }
}

module.exports = new UbicacionRepository();
