'use strict';
const { Semestre } = require('./programacion.semestre.schema');

class SemestreRepository {
  /** Retorna todos los semestres, más reciente primero */
  async findAll() {
    return Semestre.find().sort({ anio: -1, periodo: -1 }).lean();
  }

  /** Retorna un semestre por su código normalizado (ej: "2026-1") */
  async findByCodigo(codigo) {
    return Semestre.findOne({ codigo }).lean();
  }

  /**
   * Determina el semestre vigente:
   * - Primero busca uno cuya ventana de fechas incluya hoy.
   * - Si no hay ninguno activo, retorna el más recientemente cargado.
   */
  async findVigente() {
    const hoy = new Date();
    const vigente = await Semestre.findOne({
      fecha_inicio: { $lte: hoy },
      fecha_fin: { $gte: hoy },
    }).lean();
    if (vigente) return vigente;
    return Semestre.findOne().sort({ fecha_carga: -1 }).lean();
  }

  /**
   * Crea o actualiza el registro de un semestre (upsert por código).
   * @param {object} data
   */
  async upsert(data) {
    return Semestre.findOneAndUpdate(
      { codigo: data.codigo },
      { $set: data },
      { upsert: true, new: true }
    ).lean();
  }

  /** Actualiza solo las fechas de un semestre. */
  async updateFechas(codigo, fecha_inicio, fecha_fin) {
    return Semestre.findOneAndUpdate(
      { codigo },
      { $set: { fecha_inicio, fecha_fin } },
      { new: true }
    ).lean();
  }

  /** Elimina el registro de metadatos de un semestre. */
  async deleteByCodigo(codigo) {
    return Semestre.deleteOne({ codigo });
  }
}

module.exports = new SemestreRepository();
