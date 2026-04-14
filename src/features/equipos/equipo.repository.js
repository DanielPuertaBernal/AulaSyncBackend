'use strict';
const { Equipo } = require('./equipo.schema');

class EquipoRepository {
  /** @returns {Promise<object[]>} */
  async findAll() { return Equipo.find().lean(); }

  /** @param {string} id @param {object} [session] @returns {Promise<object|null>} */
  async findById(id, session = null) {
    const query = Equipo.findById(id).lean();
    if (session) query.session(session);
    return query;
  }

  /** @param {string[]} ids @param {object} [session] @returns {Promise<object[]>} */
  async findByIds(ids = [], session = null) {
    const query = Equipo.find({ _id: { $in: ids } }).lean();
    if (session) query.session(session);
    return query;
  }

  /** @param {string} codigo @returns {Promise<object|null>} */
  async findByCodigo(codigo) { return Equipo.findOne({ codigo_inventario: codigo }).lean(); }
  /** @param {string} cb - Código de barras @returns {Promise<object|null>} */
  async findByCodigoBarras(cb) { return Equipo.findOne({ codigo_barras: cb }).lean(); }
  /** @returns {Promise<object[]>} Equipos con estado 'activo' */
  async findDisponibles() { return Equipo.find({ estado: 'activo' }).lean(); }

  /** @param {object} data @returns {Promise<object>} */
  async create(data) { return (await Equipo.create(data)).toObject(); }

  /** @param {string} id @param {object} updates @returns {Promise<object|null>} */
  async update(id, updates) {
    return Equipo.findByIdAndUpdate(
      id,
      { $set: { ...updates, fecha_actualizacion: new Date() } },
      { new: true }
    ).lean();
  }

  /** @param {string} id @returns {Promise<object|null>} */
  async deleteById(id) {
    return Equipo.findByIdAndDelete(id).lean();
  }

  /** @param {string} codigoBase @returns {Promise<number>} */
  async countByCodigo(codigoBase) {
    const escaped = String(codigoBase).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`^${escaped}-`, 'i');
    return Equipo.countDocuments({ codigo_inventario: regex });
  }
}

module.exports = new EquipoRepository();
