'use strict';
const llaveService = require('./llave.service');

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
    const { fecha, documento, estado } = req.query;
    const registros = await llaveService.obtenerHistorial({ fecha, documento, estado });
    return res.json({ ok: true, data: { registros } });
  }

  async clasesProcesadasHoy(req, res) {
    const clases = await llaveService.obtenerClasesProcesadasHoy();
    return res.json({ ok: true, data: { clases } });
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
