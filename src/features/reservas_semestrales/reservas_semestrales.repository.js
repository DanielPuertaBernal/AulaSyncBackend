'use strict';
const mongoose = require('mongoose');
const { ReservaSemestral } = require('./reservas_semestrales.schema');

class ReservasSemestralesRepository {
  /** @param {string} semestre - Código normalizado (ej: "2026-1") @returns {Promise<object[]>} */
  async findBySemestre(semestre) {
    const docs = await ReservaSemestral.find({ semestre }).lean();
    return docs.map((d) => ({ ...d, facultad: d.facultad ?? 'No aplica' }));
  }

  /**
   * Obtiene reservas semestrales activas para un día específico, del semestre vigente en fechaHoy.
   * @param {string} dia - Nombre del día en español (ej: "Lunes")
   * @param {Date} fechaHoy - Fecha actual para validar vigencia del semestre
   * @returns {Promise<object[]>}
   */
  async findByDia(dia, fechaHoy) {
    const docs = await ReservaSemestral.find({
      dia,
      i_cancelada: 0,
      fecha_inicio_semestre: { $lte: fechaHoy },
      fecha_fin_semestre: { $gte: fechaHoy },
    }).lean();
    return docs.map((d) => ({ ...d, facultad: d.facultad ?? 'No aplica' }));
  }

  /** @param {string} semestre @returns {Promise<object>} */
  async deleteBySemestre(semestre) {
    return ReservaSemestral.deleteMany({ semestre });
  }

  /**
   * Reemplaza todas las reservas semestrales de un semestre con los nuevos registros.
   * @param {string} semestre - Código normalizado
   * @param {object[]} registros
   * @returns {Promise<{insertados: number}>}
   */
  async bulkInsert(semestre, registros) {
    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      await ReservaSemestral.deleteMany({ semestre }, { session });
      const result = registros.length
        ? await ReservaSemestral.insertMany(registros, { session, ordered: false })
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

module.exports = new ReservasSemestralesRepository();
