'use strict';
const BaseRepository = require('../../shared/db/base.repository');
const { Salon } = require('./salon.schema');

class SalonRepository extends BaseRepository {
  constructor() { super(Salon); }

  /** @returns {Promise<object[]>} Salones ordenados por nombre */
  async findAll() {
    return this.Model.find().sort({ nombre_salon: 1 }).lean();
  }

  /** @param {string} nombreSalon @returns {Promise<object|null>} */
  async findByNombre(nombreSalon) {
    return this.Model.findOne({ nombre_salon: nombreSalon }).lean();
  }
}

module.exports = new SalonRepository();
