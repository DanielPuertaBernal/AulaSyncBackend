'use strict';
const monitorService = require('./monitor.service');

class MonitorController {
  /** GET /api/monitores?documento_docente */
  async listar(req, res) {
    const { documento_docente } = req.query;
    const monitores = documento_docente
      ? await monitorService.listarPorDocente(documento_docente)
      : await monitorService.listarTodos();
    return res.json({ ok: true, data: { monitores } });
  }

  /** GET /api/monitores/clases/:documento */
  async clasesDocente(req, res) {
    const clases = await monitorService.obtenerClasesDocente(req.params.documento);
    return res.json({ ok: true, data: { clases } });
  }

  /** POST /api/monitores */
  async registrar(req, res) {
    const result = await monitorService.registrar(req.body);
    return res.status(201).json({ ok: true, message: result.mensaje, data: { registro: result.registro } });
  }

  /** DELETE /api/monitores/:id */
  async eliminar(req, res) {
    const result = await monitorService.eliminar(req.params.id);
    return res.json({ ok: true, message: result.mensaje });
  }
}

module.exports = new MonitorController();
