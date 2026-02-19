'use strict';
const docenteService = require('./docente.service');

class DocenteController {
  async listar(req, res) {
    const { q } = req.query;
    const docentes = q ? await docenteService.buscar(q) : await docenteService.listar();
    return res.json({ ok: true, data: { docentes } });
  }

  async obtener(req, res) {
    const docente = await docenteService.buscarPorDocumento(req.params.documento);
    return res.json({ ok: true, data: { docente } });
  }

  async obtenerPorCarnet(req, res) {
    const docente = await docenteService.buscarPorCarnet(req.params.idCarnet);
    return res.json({ ok: true, data: { docente } });
  }

  async importar(req, res) {
    if (!req.file) {
      return res.status(400).json({ ok: false, message: 'No se proporcionó archivo' });
    }
    const result = await docenteService.importarDesdeExcel(req.file.buffer);
    return res.json({
      ok: true,
      message: `Importación completa: ${result.insertados} nuevos, ${result.actualizados} actualizados`,
      data: result,
    });
  }
}

module.exports = new DocenteController();
