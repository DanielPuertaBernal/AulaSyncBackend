'use strict';
const programacionService = require('./programacion.service');

class ProgramacionController {
  /** GET /api/programacion */
  async listar(req, res) {
    const semestre = req.query.semestre || null;
    const registros = await programacionService.listar(semestre);
    return res.json({ ok: true, data: { registros } });
  }

  /** GET /api/programacion/semestres */
  async listarSemestres(req, res) {
    const semestres = await programacionService.listarSemestres();
    return res.json({ ok: true, data: { semestres } });
  }

  /** GET /api/programacion/semestres/vigente */
  async listarSemestreVigente(req, res) {
    const vigente = await programacionService.listarSemestreVigente();
    return res.json({ ok: true, data: { semestre: vigente } });
  }

  /** DELETE /api/programacion/semestres/:codigo */
  async eliminarSemestre(req, res) {
    const { codigo } = req.params;
    const result = await programacionService.eliminarSemestre(codigo);
    return res.json({ ok: true, message: `Semestre ${codigo} eliminado`, data: result });
  }

  /** PATCH /api/programacion/semestres/:codigo/fechas */
  async actualizarFechasSemestre(req, res) {
    const { codigo } = req.params;
    const { fecha_inicio, fecha_fin } = req.body;
    const actualizado = await programacionService.actualizarFechasSemestre(codigo, fecha_inicio, fecha_fin);
    return res.json({ ok: true, message: 'Fechas actualizadas', data: { semestre: actualizado } });
  }

  /** GET /api/programacion/:dia */
  async listarPorDia(req, res) {
    const { dia } = req.params;
    const semestre = req.query.semestre || null;
    let clasesConLlave = [];
    try {
      if (req.query.clasesConLlave) {
        clasesConLlave = JSON.parse(req.query.clasesConLlave);
      }
    } catch { /* ignorar */ }
    const registros = await programacionService.listarPorDia(dia, clasesConLlave, semestre);
    return res.json({ ok: true, data: { registros } });
  }

  /** POST /api/programacion/importar - Importa desde archivo Excel */
  async importar(req, res) {
    if (!req.file) return res.status(400).json({ ok: false, message: 'No se proporcionó archivo' });
    const cargadoPor = req.user?.usuario || '';
    const result = await programacionService.importarDesdeExcel(req.file.buffer, cargadoPor);
    return res.json({
      ok: true,
      message: `Programación importada: ${result.insertados} registros (Semestre ${result.semestre})`,
      data: result,
    });
  }

  /** GET /api/programacion/exportar - Descarga Excel */
  async exportar(req, res) {
    const semestre = req.query.semestre || null;
    const buffer = await programacionService.exportar(semestre);
    const nombre = semestre ? `programacion_${semestre}.xlsx` : 'programacion.xlsx';
    res.setHeader('Content-Disposition', `attachment; filename=${nombre}`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return res.send(buffer);
  }
}

module.exports = new ProgramacionController();
