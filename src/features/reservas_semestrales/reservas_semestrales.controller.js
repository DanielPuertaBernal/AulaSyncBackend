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
    const { nombre_salon, dia, hora_inicio, hora_fin, excluir_grupo_id, semestre, fecha_inicio_vigencia, fecha_fin_vigencia } = req.body;
    if (!nombre_salon || !dia || !hora_inicio || !hora_fin) {
      return res.status(400).json({ ok: false, message: 'Se requiere nombre_salon, dia, hora_inicio y hora_fin' });
    }
    const result = await reservasSemestralesService.validarConflictos({ nombre_salon, dia, hora_inicio, hora_fin, excluir_grupo_id, semestre, fecha_inicio_vigencia, fecha_fin_vigencia });
    return res.json({ ok: true, data: result });
  }

  /** POST /programacion/reservas-semestrales */
  async crearManual(req, res) {
    const { solicitante_documento, solicitante_nombre, tipo_solicitante, responsable_documento, responsable_nombre, nombre_bloque, nombre_salon, materia, franjas, forzar, semestre, fecha_inicio_vigencia, fecha_fin_vigencia } = req.body;
    if (!solicitante_documento || !solicitante_nombre || !tipo_solicitante || !materia || !Array.isArray(franjas) || franjas.length === 0) {
      return res.status(400).json({ ok: false, message: 'Faltan campos requeridos (solicitante_documento, solicitante_nombre, tipo_solicitante, materia, franjas)' });
    }
    const result = await reservasSemestralesService.crearManual({ solicitante_documento, solicitante_nombre, tipo_solicitante, responsable_documento, responsable_nombre, nombre_bloque, nombre_salon, materia, franjas, forzar: !!forzar, semestre, fecha_inicio_vigencia, fecha_fin_vigencia });
    return res.status(201).json({ ok: true, data: result });
  }

  /** GET /programacion/reservas-semestrales/salones-disponibles?dia=X&hora_inicio=Y&hora_fin=Z&semestre=W&excluir_grupo_id=G */
  async salonesDisponibles(req, res) {
    const { dia, hora_inicio, hora_fin, semestre, fecha_inicio_vigencia, fecha_fin_vigencia, excluir_grupo_id } = req.query;
    if (!dia || !hora_inicio || !hora_fin) {
      return res.status(400).json({ ok: false, message: 'Se requiere dia, hora_inicio y hora_fin' });
    }
    const result = await reservasSemestralesService.salonesDisponibles(dia, hora_inicio, hora_fin, semestre, excluir_grupo_id || null);
    return res.json({ ok: true, data: result });
  }

  /** PUT /programacion/reservas-semestrales/:id */
  async actualizar(req, res) {
    const { id } = req.params;
    const datos = req.body;
    if (!datos.solicitante_documento || !datos.solicitante_nombre || !datos.tipo_solicitante || !datos.materia || !Array.isArray(datos.franjas) || datos.franjas.length === 0) {
      return res.status(400).json({ ok: false, message: 'Faltan campos requeridos para actualizar' });
    }
    const result = await reservasSemestralesService.actualizarGrupo(id, datos);
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

  /** DELETE /programacion/reservas-semestrales/:id */
  async eliminarIndividual(req, res) {
    const { id } = req.params;
    const result = await reservasSemestralesService.eliminarIndividual(id);
    return res.json({ ok: true, data: result });
  }
}

module.exports = new ReservasSemestralesController();
