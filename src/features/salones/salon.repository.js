'use strict';
const { Salon } = require('./salon.schema');

class SalonRepository {
  /** @returns {Promise<object[]>} Salones ordenados por nombre */
  async findAll() {
    return Salon.find().sort({ nombre_salon: 1 }).lean();
  }

  /** @param {string} id @returns {Promise<object|null>} */
  async findById(id) {
    return Salon.findById(id).lean();
  }

  /** @param {string} nombreSalon @returns {Promise<object|null>} */
  async findByNombre(nombreSalon) {
    return Salon.findOne({ nombre_salon: nombreSalon }).lean();
  }

  /** @param {object} data @returns {Promise<object>} */
  async create(data) {
    return (await Salon.create(data)).toObject();
  }

  /** @param {string} id @param {object} updates @returns {Promise<object|null>} */
  async update(id, updates) {
    return Salon.findByIdAndUpdate(
      id,
      { $set: { ...updates, fecha_actualizacion: new Date() } },
      { new: true }
    ).lean();
  }

  /** @param {string} id @returns {Promise<object|null>} */
  async deleteById(id) {
    return Salon.findByIdAndDelete(id).lean();
  }
}

module.exports = new SalonRepository();
