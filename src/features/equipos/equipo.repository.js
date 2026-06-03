'use strict';
const BaseRepository = require('../../shared/db/base.repository');
const { Equipo } = require('./equipo.schema');

class EquipoRepository extends BaseRepository {
  constructor() { super(Equipo); }

  /** @returns {Promise<object[]>} */
  async findAll() { return this.Model.find().lean(); }

  /** @param {string} id @param {object} [session] @returns {Promise<object|null>} */
  async findById(id, session = null) {
    const query = this.Model.findById(id).lean();
    if (session) query.session(session);
    return query;
  }

  /** @param {string[]} ids @param {object} [session] @returns {Promise<object[]>} */
  async findByIds(ids = [], session = null) {
    const query = this.Model.find({ _id: { $in: ids } }).lean();
    if (session) query.session(session);
    return query;
  }

  /** @param {string} codigo @returns {Promise<object|null>} */
  async findByCodigo(codigo) { return this.Model.findOne({ codigo_inventario: codigo }).lean(); }

  /** @param {string} cb - Código de barras @returns {Promise<object|null>} */
  async findByCodigoBarras(cb) { return this.Model.findOne({ codigo_barras: cb }).lean(); }

  /** @returns {Promise<object[]>} Equipos con estado 'activo' */
  async findDisponibles() { return this.Model.find({ estado: 'activo' }).lean(); }

  /** @param {string} codigoBase @returns {Promise<number>} */
  async countByCodigo(codigoBase) {
    const escaped = String(codigoBase).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return this.Model.countDocuments({ codigo_inventario: new RegExp(`^${escaped}-`, 'i') });
  }

  /**
   * Busca equipos activos cuyo nombre, marca, codigo_inventario o codigo_barras
   * contengan el texto indicado (insensible a mayúsculas).
   * @param {string} q - Texto a buscar
   * @param {number} [limit=10] - Máximo de resultados
   * @returns {Promise<object[]>}
   */
  async searchByText(q, limit = 10) {
    const escaped = String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');
    return this.Model.find({
      estado: 'activo',
      $or: [
        { nombre: regex },
        { marca: regex },
        { codigo_inventario: regex },
        { codigo_barras: regex },
      ],
    }).limit(limit).lean();
  }
}

module.exports = new EquipoRepository();
