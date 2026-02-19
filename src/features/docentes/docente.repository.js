'use strict';
/**
 * Docente Repository
 * Equivale a infrastructure/repositories/docente_mongo_repository.py
 */
const { Docente } = require('./docente.schema');

class DocenteRepository {
  async findAll() {
    return Docente.find().lean();
  }

  async findByDocumento(documento) {
    return Docente.findOne({ 'Numero de documento': String(documento) }).lean();
  }

  async findByCarnet(idCarnet) {
    return Docente.findOne({ 'Id Carnet': String(idCarnet) }).lean();
  }

  async search(query) {
    const regex = new RegExp(query, 'i');
    return Docente.find({
      $or: [
        { 'Numero de documento': regex },
        { 'Nombre': regex },
      ],
    }).lean();
  }

  /**
   * Bulk upsert: inserta o actualiza por "Numero de documento"
   * Equivale a docente_excel_importer bulk save
   * @param {object[]} docentes
   * @returns {Promise<{insertados: number, actualizados: number}>}
   */
  async bulkUpsert(docentes) {
    const ops = docentes.map((d) => ({
      updateOne: {
        filter: { 'Numero de documento': d['Numero de documento'] },
        update: { $set: d },
        upsert: true,
      },
    }));
    const result = await Docente.bulkWrite(ops, { ordered: false });
    return {
      insertados: result.upsertedCount,
      actualizados: result.modifiedCount,
    };
  }
}

module.exports = new DocenteRepository();
