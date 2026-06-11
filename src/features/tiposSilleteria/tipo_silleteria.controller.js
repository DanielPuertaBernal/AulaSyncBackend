'use strict';
const tipoSilleteriaService = require('./tipo_silleteria.service');

class TipoSilleteriaController {
  async listar(req, res) {
    const tipos = await tipoSilleteriaService.listar();
    return res.json({ ok: true, data: { tipos } });
  }

  async crear(req, res) {
    const tipo = await tipoSilleteriaService.crear(req.body);
    return res.status(201).json({ ok: true, message: 'Tipo de silletería creado correctamente', data: { tipo } });
  }

  async actualizar(req, res) {
    const tipo = await tipoSilleteriaService.actualizar(req.params.id, req.body);
    return res.json({ ok: true, message: 'Tipo de silletería actualizado correctamente', data: { tipo } });
  }

  async eliminar(req, res) {
    await tipoSilleteriaService.eliminar(req.params.id);
    return res.json({ ok: true, message: 'Tipo de silletería eliminado correctamente' });
  }
}

module.exports = new TipoSilleteriaController();
