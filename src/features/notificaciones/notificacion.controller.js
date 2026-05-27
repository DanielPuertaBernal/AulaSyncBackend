'use strict';
const notificacionService = require('./notificacion.service');
const { parsePagination } = require('../../shared/utils/pagination.helper');

class NotificacionController {
  /** POST /api/notificaciones/devolucion-llaves - Envía emails de recordatorio */
  async enviarDevolucionLlaves(req, res) {
    const enviadoPor = req.user?.nombre || req.user?.usuario || 'desconocido';
    const resultado = await notificacionService.enviarNotificacionesDevolucion(req.body, enviadoPor);

    return res.json({
      ok: true,
      message: `Notificaciones enviadas: ${resultado.enviados} de ${resultado.total}`,
      data: resultado,
    });
  }

  /** GET /api/notificaciones/historial?fecha&documento&estado_envio&page&limit */
  async historial(req, res) {
    const { fecha, documento, estado_envio, tipo_notificacion, busqueda, page, limit } = req.query;
    const pagination = parsePagination({ page, limit });
    const result = await notificacionService.obtenerHistorial(
      { fecha, documento, estado_envio, tipo_notificacion, busqueda },
      pagination
    );

    if (pagination) {
      return res.json({ ok: true, data: { registros: result.data }, meta: result.meta });
    }
    return res.json({ ok: true, data: { registros: result.data || result } });
  }

  /** GET /api/notificaciones/estadisticas */
  async estadisticas(_req, res) {
    const data = await notificacionService.obtenerEstadisticas();
    return res.json({ ok: true, data });
  }

  /** GET /api/notificaciones/contadores-recordatorios */
  async contadoresRecordatorios(_req, res) {
    const data = await notificacionService.obtenerContadoresRecordatorios();
    return res.json({ ok: true, data });
  }

  /** POST /api/notificaciones/reenviar/:id */
  async reenviar(req, res) {
    const resultado = await notificacionService.reenviar(req.params.id);
    return res.json({ ok: true, data: resultado });
  }
  /** POST /api/notificaciones/reservas-manual */
  async enviarManualReservas(req, res) {
    const enviadoPor = req.user?.nombre || req.user?.usuario || 'desconocido';
    const resultado = await notificacionService.enviarNotificacionManualReservas(req.body, enviadoPor);
    return res.json({
      ok: true,
      message: `Notificaciones enviadas: ${resultado.enviados} de ${resultado.total}`,
      data: resultado,
    });
  }
}

module.exports = new NotificacionController();
