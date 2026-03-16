'use strict';
const salonService = require('./salon.service');

class SalonController {
  async listar(req, res) {
    const salones = await salonService.listar();
    return res.json({ ok: true, data: { salones } });
  }

  async crear(req, res) {
    const salon = await salonService.registrar(req.body);
    return res.status(201).json({ ok: true, message: 'Salón creado correctamente', data: { salon } });
  }

  async actualizar(req, res) {
    const salon = await salonService.actualizar(req.params.id, req.body);
    return res.json({ ok: true, message: 'Salón actualizado correctamente', data: { salon } });
  }

  async eliminar(req, res) {
    await salonService.eliminar(req.params.id);
    return res.json({ ok: true, message: 'Salón eliminado correctamente' });
  }
}

module.exports = new SalonController();
