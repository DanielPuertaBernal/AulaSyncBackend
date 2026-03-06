'use strict';
const llaveService = require('./llave.service');
const { parsePagination } = require('../../shared/utils/pagination.helper');

class LlaveController {
  async pendientes(req, res) {
    const llaves = await llaveService.obtenerPendientes();
    return res.json({ ok: true, data: { llaves } });
  }

  async pendientesHoy(req, res) {
    const llaves = await llaveService.obtenerPendientesHoy();
    return res.json({ ok: true, data: { llaves } });
  }

  async historial(req, res) {
    const { fecha, documento, estado, page, limit } = req.query;
    const pagination = parsePagination({ page, limit });
    const result = await llaveService.obtenerHistorial({ fecha, documento, estado }, pagination);

    if (pagination) {
      return res.json({ ok: true, data: { registros: result.data }, meta: result.meta });
    }
    return res.json({ ok: true, data: { registros: result } });
  }

  async clasesProcesadasHoy(req, res) {
    const clases = await llaveService.obtenerClasesProcesadasHoy();
    return res.json({ ok: true, data: { clases } });
  }

  async procesarNFC(req, res) {
    const { id_carnet } = req.body;
    const result = await llaveService.procesarLecturaNFC(id_carnet);
    return res.json({ ok: true, data: result });
  }

  async confirmarAnticipado(req, res) {
    const result = await llaveService.confirmarPrestamoAnticipado(req.body);
    return res.status(201).json({
      ok: true,
      message: result.mensaje,
      data: { registro: result.registro, docente: result.docente },
    });
  }

  async entregar(req, res) {
    const result = await llaveService.registrarEntrega(req.body);
    return res.status(201).json({ ok: true, message: result.mensaje, data: { registro: result.registro } });
  }

  async devolver(req, res) {
    const result = await llaveService.registrarDevolucion(req.params.documento);
    return res.json({ ok: true, message: result.mensaje, data: { registro: result.registro } });
  }

  async exportarHistorial(req, res) {
    const { fecha, documento, estado } = req.query;
    const buffer = await llaveService.exportarHistorial({ fecha, documento, estado });
    res.setHeader('Content-Disposition', 'attachment; filename=historial_llaves.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return res.send(buffer);
  }
}

module.exports = new LlaveController();
