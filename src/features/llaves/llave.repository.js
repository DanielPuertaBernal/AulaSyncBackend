'use strict';
const { Llave } = require('./llave.schema');
const { applyPagination } = require('../../shared/utils/pagination.helper');

class LlaveRepository {
  async findPendientes() {
    return Llave.find({ estado: 'en_prestamo' }).lean();
  }

  async findPendienteByDocumento(documento) {
    return Llave.findOne({ numero_documento: documento, estado: 'en_prestamo' }).lean();
  }

  async findByClientEventId(clientEventId) {
    if (!clientEventId) return null;
    return Llave.findOne({ client_event_id: clientEventId }).lean();
  }

  async findByFecha(fechaStr) {
    const start = new Date(`${fechaStr}T00:00:00`);
    const end = new Date(`${fechaStr}T23:59:59.999`);
    return Llave.find({ fecha_hora_entrega: { $gte: start, $lte: end } }).lean();
  }

  async findPendientesByFecha(fechaStr) {
    const start = new Date(`${fechaStr}T00:00:00`);
    const end = new Date(`${fechaStr}T23:59:59.999`);
    return Llave.find({ estado: 'en_prestamo', fecha_hora_entrega: { $gte: start, $lte: end } }).lean();
  }

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

  async create(registro) {
    return Llave.create(registro);
  }

  async update(id, updates) {
    return Llave.findByIdAndUpdate(id, { $set: updates }, { new: true }).lean();
  }
}

module.exports = new LlaveRepository();
