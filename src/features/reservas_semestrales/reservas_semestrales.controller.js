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

  /** GET /programacion/semestres/:codigo/reservas-semestrales/exportar */
  async exportar(req, res) {
    const { codigo } = req.params;
    const buffer = await reservasSemestralesService.exportar(codigo);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="reservas_semestrales_${codigo}.xlsx"`);
    return res.send(buffer);
  }

  /** GET /programacion/reservas-semestrales/dia/:dia */
  async listarPorDia(req, res) {
    const { dia } = req.params;
    const reservas = await reservasSemestralesService.listarPorDia(dia, new Date());
    return res.json({ ok: true, data: { reservas } });
  }

  /** GET /programacion/reservas-semestrales/disponibilidad?nombre_salon=X&dia=Y */
  async disponibilidad(req, res) {
    const { nombre_salon, dia } = req.query;
    if (!nombre_salon || !dia) {
      return res.status(400).json({ ok: false, message: 'Se requiere nombre_salon y dia' });
    }
    const result = await reservasSemestralesService.disponibilidadPorDia(nombre_salon, dia);
    return res.json({ ok: true, data: result });
  }

  /** POST /programacion/reservas-semestrales/validar */
  async validar(req, res) {
    const { nombre_salon, dia, hora_inicio, hora_fin, excluir_grupo_id } = req.body;
    if (!nombre_salon || !dia || !hora_inicio || !hora_fin) {
      return res.status(400).json({ ok: false, message: 'Se requiere nombre_salon, dia, hora_inicio y hora_fin' });
    }
    const result = await reservasSemestralesService.validarConflictos({ nombre_salon, dia, hora_inicio, hora_fin, excluir_grupo_id });
    return res.json({ ok: true, data: result });
  }

  /** POST /programacion/reservas-semestrales */
  async crearManual(req, res) {
    const { solicitante_documento, solicitante_nombre, tipo_solicitante, responsable_documento, responsable_nombre, nombre_bloque, nombre_salon, materia, franjas, forzar } = req.body;
    if (!solicitante_documento || !solicitante_nombre || !tipo_solicitante || !nombre_bloque || !nombre_salon || !materia || !Array.isArray(franjas) || franjas.length === 0) {
      return res.status(400).json({ ok: false, message: 'Faltan campos requeridos (solicitante_documento, solicitante_nombre, tipo_solicitante, nombre_bloque, nombre_salon, materia, franjas)' });
    }
    const result = await reservasSemestralesService.crearManual({ solicitante_documento, solicitante_nombre, tipo_solicitante, responsable_documento, responsable_nombre, nombre_bloque, nombre_salon, materia, franjas, forzar: !!forzar });
    return res.status(201).json({ ok: true, data: result });
  }

  /** GET /programacion/reservas-semestrales/salones-disponibles?dia=X&hora_inicio=Y&hora_fin=Z */
  async salonesDisponibles(req, res) {
    const { dia, hora_inicio, hora_fin } = req.query;
    if (!dia || !hora_inicio || !hora_fin) {
      return res.status(400).json({ ok: false, message: 'Se requiere dia, hora_inicio y hora_fin' });
    }
    const result = await reservasSemestralesService.salonesDisponibles(dia, hora_inicio, hora_fin);
    return res.json({ ok: true, data: result });
  }

  /** GET /programacion/reservas-semestrales/todas */
  async listarTodas(req, res) {
    const reservas = await reservasSemestralesService.listarTodas();
    return res.json({ ok: true, data: { reservas } });
  }

  /** DELETE /programacion/reservas-semestrales/grupo/:grupo_id */
  async cancelarGrupo(req, res) {
    const { grupo_id } = req.params;
    const result = await reservasSemestralesService.cancelarGrupo(grupo_id);
    return res.json({ ok: true, data: result });
  }
}

module.exports = new ReservasSemestralesController();
