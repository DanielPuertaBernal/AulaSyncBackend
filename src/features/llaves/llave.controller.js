'use strict';
const llaveService = require('./llave.service');
const { parsePagination } = require('../../shared/utils/pagination.helper');

class LlaveController {
  /** GET /api/llaves/pendientes - Llaves pendientes agrupadas */
  async pendientes(req, res) {
    const llaves = await llaveService.obtenerPendientes();
    return res.json({ ok: true, data: { llaves } });
  }

  /** GET /api/llaves/pendientes/hoy */
  async pendientesHoy(req, res) {
    const llaves = await llaveService.obtenerPendientesHoy();
    return res.json({ ok: true, data: { llaves } });
  }

  /** GET /api/llaves/pendientes/todos - Sin agrupar */
  async todosPendientes(req, res) {
    const llaves = await llaveService.obtenerTodosPendientes();
    return res.json({ ok: true, data: { llaves } });
  }

  /** GET /api/llaves/historial?fecha&documento&estado&page&limit */
  async historial(req, res) {
    const { fecha, documento, estado, page, limit } = req.query;
    const pagination = parsePagination({ page, limit });
    const result = await llaveService.obtenerHistorial({ fecha, documento, estado }, pagination);

    if (pagination) {
      return res.json({ ok: true, data: { registros: result.data }, meta: result.meta });
    }
    return res.json({ ok: true, data: { registros: result } });
  }

  /** GET /api/llaves/clases-procesadas */
  async clasesProcesadasHoy(req, res) {
    const clases = await llaveService.obtenerClasesProcesadasHoy();
    return res.json({ ok: true, data: { clases } });
  }

  /** POST /api/llaves/nfc - Procesa lectura NFC para préstamo/devolución */
  async procesarNFC(req, res) {
    const { id_carnet, ubicacion } = req.body;
    const result = await llaveService.procesarLecturaNFC(id_carnet, ubicacion);
    return res.json({ ok: true, data: result });
  }

  /** POST /api/llaves/anticipado - Confirma préstamo anticipado */
  async confirmarAnticipado(req, res) {
    const result = await llaveService.confirmarPrestamoAnticipado(req.body);
    return res.status(201).json({
      ok: true,
      message: result.mensaje,
      data: { registro: result.registro, docente: result.docente },
    });
  }

  /** POST /api/llaves/entregar - Entrega manual de llave */
  async entregar(req, res) {
    const result = await llaveService.registrarEntrega(req.body);
    return res.status(201).json({ ok: true, message: result.mensaje, data: { registro: result.registro } });
  }

  /** PATCH /api/llaves/devolver/:documento */
  async devolver(req, res) {
    const result = await llaveService.registrarDevolucion(req.params.documento, req.body?.ubicacion);
    return res.json({ ok: true, message: result.mensaje, data: { registro: result.registro } });
  }

  /** GET /api/llaves/historial/exportar - Descarga Excel */
  async exportarHistorial(req, res) {
    const { fecha, documento, estado } = req.query;
    const buffer = await llaveService.exportarHistorial({ fecha, documento, estado });
    res.setHeader('Content-Disposition', 'attachment; filename=historial_llaves.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return res.send(buffer);
  }
}

module.exports = new LlaveController();
