'use strict';
const programacionService = require('./programacion.service');

class ProgramacionController {
  /** GET /api/programacion */
  async listar(req, res) {
    const registros = await programacionService.listar();
    return res.json({ ok: true, data: { registros } });
  }

  /** GET /api/programacion/:dia */
  async listarPorDia(req, res) {
    const { dia } = req.params;
    // Las clases con llave se pasan como query param JSON (opcional)
    let clasesConLlave = [];
    try {
      if (req.query.clasesConLlave) {
        clasesConLlave = JSON.parse(req.query.clasesConLlave);
      }
    } catch { /* ignorar */ }
    const registros = await programacionService.listarPorDia(dia, clasesConLlave);
    return res.json({ ok: true, data: { registros } });
  }

  /** POST /api/programacion/importar - Importa desde archivo Excel */
  async importar(req, res) {
    if (!req.file) return res.status(400).json({ ok: false, message: 'No se proporcionó archivo' });
    const result = await programacionService.importarDesdeExcel(req.file.buffer);
    return res.json({ ok: true, message: `Programación importada: ${result.insertados} registros`, data: result });
  }

  /** GET /api/programacion/exportar - Descarga Excel */
  async exportar(req, res) {
    const buffer = await programacionService.exportar();
    res.setHeader('Content-Disposition', 'attachment; filename=programacion.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return res.send(buffer);
  }
}

module.exports = new ProgramacionController();
