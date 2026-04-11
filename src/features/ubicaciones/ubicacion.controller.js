'use strict';
const ubicacionService = require('./ubicacion.service');
const { ROLES } = require('../auth/auth.middleware');

class UbicacionController {
  async listar(req, res) {
    const incluirInactivas = req.user?.rol === ROLES.ADMIN && String(req.query?.incluir_inactivas || '').toLowerCase() === 'true';
    const ubicaciones = await ubicacionService.listar({ incluirInactivas });
    return res.json({ ok: true, data: { ubicaciones } });
  }

  async obtener(req, res) {
    const permitirInactiva = req.user?.rol === ROLES.ADMIN;
    const ubicacion = await ubicacionService.obtenerPorClave(req.params.clave, { permitirInactiva });
    return res.json({ ok: true, data: { ubicacion } });
  }

  async crear(req, res) {
    const actor = req.user?.usuario || req.user?.nombre || 'admin';
    const ubicacion = await ubicacionService.registrar(req.body, actor);
    return res.status(201).json({ ok: true, message: 'Ubicación creada correctamente', data: { ubicacion } });
  }

  async actualizar(req, res) {
    const actor = req.user?.usuario || req.user?.nombre || 'admin';
    const ubicacion = await ubicacionService.actualizar(req.params.id, req.body, actor);
    return res.json({ ok: true, message: 'Ubicación actualizada correctamente', data: { ubicacion } });
  }

  async eliminar(req, res) {
    await ubicacionService.eliminar(req.params.id);
    return res.json({ ok: true, message: 'Ubicación eliminada correctamente' });
  }
}

module.exports = new UbicacionController();
