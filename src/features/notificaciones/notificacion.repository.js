'use strict';
const { Notificacion } = require('./notificacion.schema');
const { applyPagination } = require('../../shared/utils/pagination.helper');

class NotificacionRepository {
  async create(data) {
    return Notificacion.create(data);
  }

  async createMany(docs) {
    return Notificacion.insertMany(docs, { ordered: false }).catch((err) => {
      // Ignore duplicate key errors from unique index (already sent notifications)
      if (err.code === 11000 || err.writeErrors?.every((e) => e.err?.code === 11000)) {
        return err.insertedDocs || [];
      }
      throw err;
    });
  }

  async findHistorial(filters = {}, pagination = null) {
    const query = {};
    if (filters.fecha) {
      const start = new Date(`${filters.fecha}T00:00:00`);
      const end = new Date(`${filters.fecha}T23:59:59.999`);
      query.fecha_envio = { $gte: start, $lte: end };
    }
    if (filters.desde || filters.hasta) {
      query.fecha_envio = query.fecha_envio || {};
      if (filters.desde) query.fecha_envio.$gte = new Date(`${filters.desde}T00:00:00`);
      if (filters.hasta) query.fecha_envio.$lte = new Date(`${filters.hasta}T23:59:59.999`);
    }
    if (filters.documento) query.destinatario_documento = filters.documento;
    if (filters.estado_envio) query.estado_envio = filters.estado_envio;
    if (filters.tipo_notificacion) query.tipo_notificacion = filters.tipo_notificacion;
    if (filters.busqueda) {
      query.$or = [
        { destinatario_nombre: { $regex: filters.busqueda, $options: 'i' } },
        { destinatario_documento: { $regex: filters.busqueda, $options: 'i' } },
      ];
    }
    return applyPagination(
      Notificacion.find(query).sort({ fecha_envio: -1 }),
      pagination
    );
  }

  async findById(id) {
    return Notificacion.findById(id).lean();
  }

  async updateById(id, updates) {
    return Notificacion.findByIdAndUpdate(id, { $set: updates }, { new: true }).lean();
  }

  async countByPrestamoAndTipo(prestamoLlaveId, tipoNotificacion) {
    return Notificacion.countDocuments({
      prestamo_llave_id: prestamoLlaveId,
      tipo_notificacion: tipoNotificacion,
    });
  }

  /** Devuelve un mapa { [llave_id]: count } con los recordatorios enviados por préstamo */
  async contarRecordatoriosPorLlaves() {
    const result = await Notificacion.aggregate([
      { $match: { tipo_notificacion: 'recordatorio', estado_envio: 'enviado' } },
      { $group: { _id: '$prestamo_llave_id', count: { $sum: 1 } } },
    ]);
    return result.reduce((acc, r) => {
      if (r._id) acc[r._id.toString()] = r.count;
      return acc;
    }, {});
  }

  async findLastByPrestamo(prestamoLlaveId) {
    return Notificacion.findOne({ prestamo_llave_id: prestamoLlaveId })
      .sort({ fecha_envio: -1 })
      .lean();
  }

  async findPendientesReintento(ahora) {
    return Notificacion.find({
      estado_envio: 'pendiente',
      intentos_envio: { $gt: 0, $lt: 3 },
      proximo_reintento: { $lte: ahora },
    }).lean();
  }

  /**
   * Devuelve hasta `limit` notificaciones listas para enviar:
   * estado pendiente Y (sin reintento programado OR reintento ya vencido).
   */
  async findPendientesEnvio(limit = 50) {
    const ahora = new Date();
    return Notificacion.find({
      estado_envio: 'pendiente',
      $or: [
        { proximo_reintento: null },
        { proximo_reintento: { $lte: ahora } },
      ],
    })
      .sort({ fecha_envio: 1 })
      .limit(limit)
      .lean();
  }

  async estadisticas() {
    const [porEstado, porTipo] = await Promise.all([
      Notificacion.aggregate([
        { $group: { _id: '$estado_envio', total: { $sum: 1 } } },
      ]),
      Notificacion.aggregate([
        { $group: { _id: '$tipo_notificacion', total: { $sum: 1 } } },
      ]),
    ]);
    return {
      por_estado: Object.fromEntries(porEstado.map((r) => [r._id, r.total])),
      por_tipo: Object.fromEntries(porTipo.map((r) => [r._id, r.total])),
    };
  }
}

module.exports = new NotificacionRepository();
