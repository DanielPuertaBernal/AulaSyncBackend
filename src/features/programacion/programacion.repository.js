'use strict';
const mongoose = require('mongoose');
const { Programacion } = require('./programacion.schema');

class ProgramacionRepository {
  /** @returns {Promise<object[]>} */
  async findAll() {
    return Programacion.find().lean();
  }

  /** @param {string} dia - Nombre del día (ej: 'Lunes') @returns {Promise<object[]>} */
  async findByDia(dia) {
    const sinTildes = dia.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const pattern = sinTildes.split('').map((ch) => {
      const map = { a: '[aá]', e: '[eé]', i: '[ií]', o: '[oó]', u: '[uú]' };
      return map[ch.toLowerCase()] || ch;
    }).join('');
    return Programacion.find({ dia: new RegExp(`^${pattern}$`, 'i') }).lean();
  }

  /** @param {string} documento @returns {Promise<object[]>} */
  async findByDocumento(documento) {
    return Programacion.find({ numero_documento: documento }).lean();
  }

  /** @param {object[]} registros @returns {Promise<{insertados: number}>} Reemplaza toda la programación */
  async bulkInsert(registros) {
    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      await Programacion.deleteMany({}, { session });
      const result = registros.length
        ? await Programacion.insertMany(registros, { session, ordered: false })
        : [];
      await session.commitTransaction();
      return { insertados: result.length };
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }
}

module.exports = new ProgramacionRepository();
