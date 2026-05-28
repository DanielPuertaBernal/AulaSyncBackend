'use strict';
const { Llave } = require('./llave.schema');
const { applyPagination } = require('../../shared/utils/pagination.helper');

class LlaveRepository {
  /** @returns {Promise<object[]>} Registros con préstamo activo (en_prestamo, en_mora, demora_entrega) */
  async findPendientes() {
    return Llave.find({ estado: { $in: ['en_prestamo', 'en_mora', 'demora_entrega'] } }).lean();
  }

  /** @param {string} documento @returns {Promise<object|null>} */
  async findPendienteByDocumento(documento) {
    return Llave.findOne({ numero_documento: documento, estado: { $in: ['en_prestamo', 'en_mora', 'demora_entrega'] } }).lean();
  }

  /** @param {string} documento @returns {Promise<object[]>} Todos los préstamos activos del docente */
  async findPendientesByDocumento(documento) {
    return Llave.find({ numero_documento: documento, estado: { $in: ['en_prestamo', 'en_mora', 'demora_entrega'] } }).lean();
  }

  /** @param {string} id @returns {Promise<object|null>} */
  async findById(id) {
    return Llave.findById(id).lean();
  }

  /** @param {string} fechaStr - Formato YYYY-MM-DD @returns {Promise<object[]>} */
  async findByFecha(fechaStr) {
    const start = new Date(`${fechaStr}T00:00:00`);
    const end = new Date(`${fechaStr}T23:59:59.999`);
    return Llave.find({ fecha_hora_entrega: { $gte: start, $lte: end } }).lean();
  }

  /** @param {string} fechaStr - Formato YYYY-MM-DD @returns {Promise<object[]>} */
  async findPendientesByFecha(fechaStr) {
    const start = new Date(`${fechaStr}T00:00:00`);
    const end = new Date(`${fechaStr}T23:59:59.999`);
    return Llave.find({ estado: { $in: ['en_prestamo', 'en_mora', 'demora_entrega'] }, fecha_hora_entrega: { $gte: start, $lte: end } }).lean();
  }

  /** @param {object} filters @param {object|null} pagination @returns {Promise<object>} */
  async findHistorial(filters = {}, pagination = null) {
    const query = {};
    if (filters.fecha) {
      const start = new Date(`${filters.fecha}T00:00:00`);
      const end = new Date(`${filters.fecha}T23:59:59.999`);
      query.fecha_hora_entrega = { $gte: start, $lte: end };
    }
    if (filters.documento) query.numero_documento = filters.documento;
    if (filters.estado) query.estado = filters.estado;
    return applyPagination(Llave.find(query).sort({ fecha_hora_entrega: -1 }), pagination);
  }

  /** @param {object} registro @returns {Promise<object>} */
  async create(registro) {
    return Llave.create(registro);
  }

  /** @param {string} id @param {object} updates @returns {Promise<object|null>} */
  async update(id, updates) {
    return Llave.findByIdAndUpdate(id, { $set: updates }, { new: true }).lean();
  }
}

module.exports = new LlaveRepository();
