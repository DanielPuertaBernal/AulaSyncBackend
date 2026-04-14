'use strict';
const equipoService = require('./equipo.service');

class EquipoController {
  /** GET /api/equipos */
  async listar(req, res) {
    const equipos = await equipoService.listar();
    return res.json({ ok: true, data: { equipos } });
  }
  /** GET /api/equipos/disponibles */
  async disponibles(req, res) {
    const equipos = await equipoService.disponibles();
    return res.json({ ok: true, data: { equipos } });
  }
  /** POST /api/equipos */
  async crear(req, res) {
    const equipo = await equipoService.registrar(req.body);
    return res.status(201).json({ ok: true, message: 'Equipo registrado', data: { equipo } });
  }
  /** PUT /api/equipos/:id */
  async actualizar(req, res) {
    const equipo = await equipoService.actualizar(req.params.id, req.body);
    return res.json({ ok: true, message: 'Equipo actualizado', data: { equipo } });
  }
  /** GET /api/equipos/barcode/:codigo */
  async buscarPorBarcode(req, res) {
    const equipo = await equipoService.buscarPorCodigoBarras(req.params.codigo);
    return res.json({ ok: true, data: { equipo } });
  }

  /** DELETE /api/equipos/:id */
  async eliminar(req, res) {
    await equipoService.eliminar(req.params.id);
    return res.json({ ok: true, message: 'Equipo eliminado' });
  }
}

module.exports = new EquipoController();
