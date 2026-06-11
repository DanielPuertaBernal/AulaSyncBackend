'use strict';
const BaseRepository = require('../../shared/db/base.repository');
const { TipoSilleteria } = require('./tipo_silleteria.schema');

class TipoSilleteriaRepository extends BaseRepository {
  constructor() { super(TipoSilleteria); }

  async findAll() {
    return this.Model.find().sort({ nombre: 1 }).lean();
  }

  async findByNombre(nombre) {
    return this.Model.findOne({ nombre }).lean();
  }
}

module.exports = new TipoSilleteriaRepository();
