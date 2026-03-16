'use strict';
const bloqueService = require('./bloque.service');

class BloqueController {
  async listar(req, res) {
    const bloques = await bloqueService.listar();
    return res.json({ ok: true, data: { bloques } });
  }

  async crear(req, res) {
    const bloque = await bloqueService.crear(req.body);
    return res.status(201).json({ ok: true, message: 'Bloque creado correctamente', data: { bloque } });
  }

  async actualizar(req, res) {
    const bloque = await bloqueService.actualizar(req.params.id, req.body);
    return res.json({ ok: true, message: 'Bloque actualizado correctamente', data: { bloque } });
  }

  async eliminar(req, res) {
    await bloqueService.eliminar(req.params.id);
    return res.json({ ok: true, message: 'Bloque eliminado correctamente' });
  }
}

module.exports = new BloqueController();
