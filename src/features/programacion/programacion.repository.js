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
    const filter = { tipo: 'programacion', dia: new RegExp(`^${pattern}$`, 'i') };
    if (semestre) filter.semestre = semestre;
    return Programacion.find(filter).lean();
  }

  /** @param {string} documento @returns {Promise<object[]>} */
  async findByDocumento(documento) {
    return Programacion.find({ numero_documento: documento }).lean();
  }

  /** @param {string} semestre - Código normalizado (ej: "2026-1") @returns {Promise<object[]>} */
  async findBySemestre(semestre) {
    return Programacion.find({ semestre, tipo: 'programacion' }).lean();
  }

  /** Elimina todos los registros de un semestre. @param {string} semestre */
  async deleteBySemestre(semestre) {
    return Programacion.deleteMany({ semestre });
  }

  /** Propaga nuevas fechas de semestre a todos los registros de programación y semestrales del semestre dado. */
  async updateFechasPorSemestre(semestre, fecha_inicio_semestre, fecha_fin_semestre) {
    return Programacion.updateMany(
      { semestre },
      { $set: { fecha_inicio_semestre, fecha_fin_semestre } }
    );
  }

  /** @param {string} id @param {object} update */
  async updateById(id, update) {
    return Programacion.findByIdAndUpdate(id, update, { new: true }).lean();
  }

  /** @param {object[]} registros @param {string} semestre - Código normalizado del semestre a reemplazar @returns {Promise<{insertados: number}>} Reemplaza solo los registros de tipo 'programacion' del semestre indicado (no toca semestrales) */
  async bulkInsert(registros, semestre) {
    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      await Programacion.deleteMany({ semestre, tipo: 'programacion' }, { session });
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
