'use strict';
const mongoose = require('mongoose');
const { Programacion } = require('./programacion.schema');

class ProgramacionRepository {
  /** @returns {Promise<object[]>} */
  async findAll() {
    return Programacion.find().lean();
  }

  /** @param {string} dia - Nombre del día (ej: 'Lunes') @param {string|null} semestre - Código normalizado del semestre @returns {Promise<object[]>} */
  async findByDia(dia, semestre = null) {
    const sinTildes = dia.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const pattern = sinTildes.split('').map((ch) => {
      const map = { a: '[aá]', e: '[eé]', i: '[ií]', o: '[oó]', u: '[uú]' };
      return map[ch.toLowerCase()] || ch;
    }).join('');
    const filter = { dia: new RegExp(`^${pattern}$`, 'i') };
    if (semestre) filter.semestre = semestre;
    return Programacion.find(filter).lean();
  }

  /** @param {string} documento @returns {Promise<object[]>} */
  async findByDocumento(documento) {
    return Programacion.find({ numero_documento: documento }).lean();
  }

  /** @param {string} semestre - Código normalizado (ej: "2026-1") @returns {Promise<object[]>} */
  async findBySemestre(semestre) {
    return Programacion.find({ semestre }).lean();
  }

  /** Elimina todos los registros de un semestre. @param {string} semestre */
  async deleteBySemestre(semestre) {
    return Programacion.deleteMany({ semestre });
  }

  /** @param {object[]} registros @param {string} semestre - Código normalizado del semestre a reemplazar @returns {Promise<{insertados: number}>} Reemplaza la programación solo del semestre indicado */
  async bulkInsert(registros, semestre) {
    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      await Programacion.deleteMany({ semestre }, { session });
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
