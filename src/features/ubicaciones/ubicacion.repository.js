'use strict';
const { Ubicacion } = require('./ubicacion.schema');

class UbicacionRepository {
  async findAll({ soloActivas = true } = {}) {
    const filter = soloActivas ? { activa: true } : {};
    return Ubicacion.find(filter).sort({ nombre: 1 }).lean();
  }

  async findById(id) {
    return Ubicacion.findById(id).lean();
  }

  async findByClave(clave) {
    return Ubicacion.findOne({ clave }).lean();
  }

  async create(data) {
    return (await Ubicacion.create(data)).toObject();
  }

  async update(id, updates) {
    return Ubicacion.findByIdAndUpdate(
      id,
      { $set: { ...updates, fecha_actualizacion: new Date() } },
      { new: true }
    ).lean();
  }

  async deleteById(id) {
    return Ubicacion.findByIdAndDelete(id).lean();
  }

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
