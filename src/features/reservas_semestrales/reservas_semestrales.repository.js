'use strict';
const mongoose = require('mongoose');
const { Programacion } = require('../programacion/programacion.schema');

class ReservasSemestralesRepository {
  /** @param {string} semestre - Código normalizado (ej: "2026-1") @returns {Promise<object[]>} */
  async findBySemestre(semestre) {
    return Programacion.find({ semestre, tipo: 'semestral' }).lean();
  }

  /**
   * Obtiene reservas semestrales activas para un día específico, del semestre vigente en fechaHoy.
   * @param {string} dia - Nombre del día en español (ej: "Lunes")
   * @param {Date} fechaHoy - Fecha actual para validar vigencia del semestre
   * @returns {Promise<object[]>}
   */
  async findByDia(dia, fechaHoy) {
    return Programacion.find({
      tipo: 'semestral',
      dia,
      i_cancelada: 0,
      fecha_inicio_semestre: { $lte: fechaHoy },
      fecha_fin_semestre: { $gte: fechaHoy },
    }).lean();
  }

  /**
   * Obtiene reservas semestrales de un salón en un día específico del semestre dado.
   * @param {string} aula
   * @param {string} dia
   * @param {string} semestre - Código normalizado
   * @returns {Promise<object[]>}
   */
  async findByAulaDia(aula, dia, semestre) {
    return Programacion.find({
      tipo: 'semestral',
      aula,
      dia: new RegExp(dia, 'i'),
      semestre,
      i_cancelada: { $ne: 1 },
    }).lean();
  }

  /**
   * Obtiene todas las reservas semestrales (de todos los semestres), para listado global.
   * @returns {Promise<object[]>}
   */
  async findAll() {
    return Programacion.find({ tipo: 'semestral' }).sort({ semestre: -1, grupo_id: 1, dia: 1 }).lean();
  }

  /**
   * Elimina todas las franjas de un grupo manual.
   * @param {string} grupo_id
   * @returns {Promise<object>}
   */
  async deleteByGrupoId(grupo_id) {
    return Programacion.deleteMany({ grupo_id, tipo: 'semestral' });
  }

  /**
   * Encuentra al menos una franja de un grupo (para validar que existe y es manual).
   * @param {string} grupo_id
   * @returns {Promise<object|null>}
   */
  async findOneByGrupoId(grupo_id) {
    return Programacion.findOne({ grupo_id, tipo: 'semestral' }).lean();
  }

  /** @param {string} semestre @returns {Promise<object>} */
  async deleteBySemestre(semestre) {
    return Programacion.deleteMany({ semestre, tipo: 'semestral' });
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
      await Programacion.deleteMany({ semestre, tipo: 'semestral' }, { session });
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

module.exports = new ReservasSemestralesRepository();
