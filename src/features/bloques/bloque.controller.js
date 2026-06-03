'use strict';
const bloqueService = require('./bloque.service');

class BloqueController {
  /** GET /api/bloques */
  async listar(req, res) {
    const bloques = await bloqueService.listar();
    return res.json({ ok: true, data: { bloques } });
  }

  /** POST /api/bloques */
  async crear(req, res) {
    const bloque = await bloqueService.crear(req.body);
    return res.status(201).json({ ok: true, message: 'Bloque creado correctamente', data: { bloque } });
  }

  /** PUT /api/bloques/:id */
  async actualizar(req, res) {
    const bloque = await bloqueService.actualizar(req.params.id, req.body);
    return res.json({ ok: true, message: 'Bloque actualizado correctamente', data: { bloque } });
  }

  /** DELETE /api/bloques/:id */
  async eliminar(req, res) {
    await bloqueService.eliminar(req.params.id);
    return res.json({ ok: true, message: 'Bloque eliminado correctamente' });
  }
}

module.exports = new BloqueController();
