'use strict';
const reservasSemestralesService = require('./reservas_semestrales.service');

class ReservasSemestralesController {
  /** GET /programacion/semestres/:codigo/reservas-semestrales */
  async listar(req, res) {
    const { codigo } = req.params;
    const reservas = await reservasSemestralesService.listar(codigo);
    return res.json({ ok: true, data: { reservas } });
  }

  /** POST /programacion/semestres/:codigo/reservas-semestrales/importar */
  async importar(req, res) {
    const { codigo } = req.params;
    if (!req.file) {
      return res.status(400).json({ ok: false, message: 'No se recibió archivo Excel' });
    }
    const result = await reservasSemestralesService.importarDesdeExcel(
      codigo,
      req.file.buffer,
      req.user?.usuario || ''
    );
    return res.json({ ok: true, data: result });
  }

  /** DELETE /programacion/semestres/:codigo/reservas-semestrales */
  async eliminar(req, res) {
    const { codigo } = req.params;
    await reservasSemestralesService.eliminarPorSemestre(codigo);
    return res.json({ ok: true, data: { eliminado: true, semestre: codigo } });
  }

  /** GET /programacion/reservas-semestrales/dia/:dia */
  async listarPorDia(req, res) {
    const { dia } = req.params;
    const reservas = await reservasSemestralesService.listarPorDia(dia, new Date());
    return res.json({ ok: true, data: { reservas } });
  }
}

module.exports = new ReservasSemestralesController();
