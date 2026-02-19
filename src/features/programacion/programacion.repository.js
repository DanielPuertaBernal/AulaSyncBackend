'use strict';
const { Programacion } = require('./programacion.schema');

class ProgramacionRepository {
  async findAll() {
    return Programacion.find().lean();
  }

  async findByDia(dia) {
    return Programacion.find({ 'Día': dia }).lean();
  }

  async findByDocumento(documento) {
    return Programacion.find({ 'Número de Documento': documento }).lean();
  }

  async deleteAll() {
    return Programacion.deleteMany({});
  }

  /**
   * Bulk insert (reemplaza toda la programación)
   * @param {object[]} registros
   */
  async bulkInsert(registros) {
    await this.deleteAll();
    if (!registros.length) return { insertados: 0 };
    const result = await Programacion.insertMany(registros, { ordered: false });
    return { insertados: result.length };
  }
}

module.exports = new ProgramacionRepository();
