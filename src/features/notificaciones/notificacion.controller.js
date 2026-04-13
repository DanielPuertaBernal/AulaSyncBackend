'use strict';
const notificacionService = require('./notificacion.service');
const { parsePagination } = require('../../shared/utils/pagination.helper');

class NotificacionController {
  async enviarDevolucionLlaves(req, res) {
    const enviadoPor = req.user?.nombre || req.user?.usuario || 'desconocido';
    const resultado = await notificacionService.enviarNotificacionesDevolucion(req.body, enviadoPor);

    return res.json({
      ok: true,
      message: `Notificaciones enviadas: ${resultado.enviados} de ${resultado.total}`,
      data: resultado,
    });
  }

  async historial(req, res) {
    const { fecha, documento, estado_envio, page, limit } = req.query;
    const pagination = parsePagination({ page, limit });
    const result = await notificacionService.obtenerHistorial(
      { fecha, documento, estado_envio },
      pagination
    );

    if (pagination) {
      return res.json({ ok: true, data: { registros: result.data }, meta: result.meta });
    }
    return res.json({ ok: true, data: { registros: result.data || result } });
  }
}

module.exports = new NotificacionController();
