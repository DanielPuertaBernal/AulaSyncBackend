'use strict';
const { Bloque } = require('./bloque.schema');

class BloqueRepository {
  async findAll() {
    return Bloque.find().sort({ nombre_bloque: 1 }).lean();
  }

  async findById(id) {
    return Bloque.findById(id).lean();
  }

  async findByNombre(nombreBloque) {
    return Bloque.findOne({ nombre_bloque: nombreBloque }).lean();
  }

  async create(data) {
    return (await Bloque.create(data)).toObject();
  }

  async update(id, updates) {
    return Bloque.findByIdAndUpdate(
      id,
      { $set: { ...updates, fecha_actualizacion: new Date() } },
      { new: true }
    ).lean();
  }

  async deleteById(id) {
    return Bloque.findByIdAndDelete(id).lean();
  }
}

module.exports = new BloqueRepository();
