'use strict';
const { Reserva } = require('./reserva.schema');
const { applyPagination } = require('../../shared/utils/pagination.helper');

class ReservaRepository {
  async create(data) {
    return Reserva.create(data);
  }

  async findById(id) {
    return Reserva.findById(id).lean();
  }

  async updateById(id, updates) {
    return Reserva.findByIdAndUpdate(id, { $set: updates }, { new: true }).lean();
  }

  async findHistorial(filters = {}, pagination = null) {
    const query = {};
    if (filters.nombre_bloque) query.nombre_bloque = filters.nombre_bloque;
    if (filters.nombre_salon) query.nombre_salon = filters.nombre_salon;
    if (filters.estado) query.estado = filters.estado;
    if (filters.solicitante_documento) query.solicitante_documento = filters.solicitante_documento;
    if (filters.fecha) {
      const start = new Date(`${filters.fecha}T00:00:00`);
      const end = new Date(`${filters.fecha}T23:59:59.999`);
      query.fecha = { $gte: start, $lte: end };
    }
    if (filters.busqueda) {
      const escaped = String(filters.busqueda).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      query.$or = [
        { solicitante_nombre: regex },
        { solicitante_documento: regex },
        { motivo: regex },
      ];
    }
    return applyPagination(Reserva.find(query).sort({ fecha: -1, hora_inicio: 1 }), pagination);
  }

  /**
   * Busca reservas activas que se solapen con el rango horario dado en un salón y fecha.
   */
  async findConflictos(nombre_salon, fecha, hora_inicio, hora_fin, excludeId = null) {
    const start = new Date(`${fecha}T00:00:00`);
    const end = new Date(`${fecha}T23:59:59.999`);
    const query = {
      nombre_salon,
      fecha: { $gte: start, $lte: end },
      estado: { $in: ['pendiente', 'aprobada'] },
      $or: [
        { hora_inicio: { $lt: hora_fin }, hora_fin: { $gt: hora_inicio } },
      ],
    };
    if (excludeId) query._id = { $ne: excludeId };
    return Reserva.find(query).lean();
  }

  /**
   * Obtiene todas las reservas activas de un salón en una fecha dada.
   */
  async findBySalonYFecha(nombre_salon, fecha) {
    const start = new Date(`${fecha}T00:00:00`);
    const end = new Date(`${fecha}T23:59:59.999`);
    return Reserva.find({
      nombre_salon,
      fecha: { $gte: start, $lte: end },
      estado: { $in: ['pendiente', 'aprobada'] },
    }).sort({ hora_inicio: 1 }).lean();
  }
}

module.exports = new ReservaRepository();
