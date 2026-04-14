'use strict';
const { Notificacion } = require('./notificacion.schema');
const { applyPagination } = require('../../shared/utils/pagination.helper');

class NotificacionRepository {
  /** @param {object} data @returns {Promise<object>} */
  async create(data) {
    return Notificacion.create(data);
  }

  /** @param {object[]} docs @returns {Promise<object[]>} */
  async createMany(docs) {
    return Notificacion.insertMany(docs);
  }

  /** @param {object} filters @param {object|null} pagination @returns {Promise<object>} */
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
