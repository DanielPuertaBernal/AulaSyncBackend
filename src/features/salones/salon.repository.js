'use strict';
const { Salon } = require('./salon.schema');

class SalonRepository {
  async findAll() {
    return Salon.find().sort({ nombre_salon: 1 }).lean();
  }

  async findById(id) {
    return Salon.findById(id).lean();
  }

  async findByNombre(nombreSalon) {
    return Salon.findOne({ nombre_salon: nombreSalon }).lean();
  }

  async create(data) {
    return (await Salon.create(data)).toObject();
  }

  async update(id, updates) {
    return Salon.findByIdAndUpdate(
      id,
      { $set: { ...updates, fecha_actualizacion: new Date() } },
      { new: true }
    ).lean();
  }

  async deleteById(id) {
    return Salon.findByIdAndDelete(id).lean();
  }
}

module.exports = new SalonRepository();
