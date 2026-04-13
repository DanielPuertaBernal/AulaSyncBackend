'use strict';
const { Notificacion } = require('./notificacion.schema');
const { applyPagination } = require('../../shared/utils/pagination.helper');

class NotificacionRepository {
  async create(data) {
    return Notificacion.create(data);
  }

  async createMany(docs) {
    return Notificacion.insertMany(docs);
  }

  async findHistorial(filters = {}, pagination = null) {
    const query = {};
    if (filters.fecha) {
      const start = new Date(`${filters.fecha}T00:00:00`);
      const end = new Date(`${filters.fecha}T23:59:59.999`);
      query.fecha_envio = { $gte: start, $lte: end };
    }
    if (filters.documento) query.destinatario_documento = filters.documento;
    if (filters.estado_envio) query.estado_envio = filters.estado_envio;
    return applyPagination(
      Notificacion.find(query).sort({ fecha_envio: -1 }),
      pagination
    );
  }
}

module.exports = new NotificacionRepository();
