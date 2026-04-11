'use strict';
const { Equipo } = require('./equipo.schema');

class EquipoRepository {
  async findAll() { return Equipo.find().lean(); }

  async findById(id, session = null) {
    const query = Equipo.findById(id).lean();
    if (session) query.session(session);
    return query;
  }

  async findByIds(ids = [], session = null) {
    const query = Equipo.find({ _id: { $in: ids } }).lean();
    if (session) query.session(session);
    return query;
  }

  async findByCodigo(codigo) { return Equipo.findOne({ codigo_inventario: codigo }).lean(); }
  async findByCodigoBarras(cb) { return Equipo.findOne({ codigo_barras: cb }).lean(); }
  async findDisponibles() { return Equipo.find({ estado: 'activo' }).lean(); }

  async create(data) { return (await Equipo.create(data)).toObject(); }

  async update(id, updates) {
    return Equipo.findByIdAndUpdate(
      id,
      { $set: { ...updates, fecha_actualizacion: new Date() } },
      { new: true }
    ).lean();
  }

  async deleteById(id) {
    return Equipo.findByIdAndDelete(id).lean();
  }

  async countByCodigo(codigoBase) {
    const escaped = String(codigoBase).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`^${escaped}-`, 'i');
    return Equipo.countDocuments({ codigo_inventario: regex });
  }
}

module.exports = new EquipoRepository();
