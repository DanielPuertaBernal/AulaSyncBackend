'use strict';
const prestamoService = require('./prestamo.service');

class PrestamoController {
  async listar(req, res) {
    const prestamos = await prestamoService.listar();
    return res.json({ ok: true, data: { prestamos } });
  }
  async activos(req, res) {
    const prestamos = await prestamoService.activos();
    return res.json({ ok: true, data: { prestamos } });
  }
  async porDocente(req, res) {
    const prestamos = await prestamoService.porDocente(req.params.nfc);
    return res.json({ ok: true, data: { prestamos } });
  }
  async crear(req, res) {
    const prestamo = await prestamoService.crear({
      ...req.body,
      auxiliar_prestamista: req.body.auxiliar_prestamista || req.user.nombre,
    });
    return res.status(201).json({ ok: true, message: 'Préstamo creado', data: { prestamo } });
  }
  async agregarEquipo(req, res) {
    const { equipoId } = req.body;
    const prestamo = await prestamoService.agregarEquipo(req.params.id, equipoId, req.user.nombre);
    return res.json({ ok: true, message: 'Equipo agregado al préstamo', data: { prestamo } });
  }
  async devolucion(req, res) {
    const result = await prestamoService.registrarDevolucion({
      ...req.body,
      auxiliar_que_recibio: req.body.auxiliar_que_recibio || req.user.nombre,
    });
    return res.json({
      ok: true,
      message: result.prestamo_estado === 'completamente_devuelto'
        ? 'Devolución completa registrada'
        : 'Devolución parcial registrada',
      data: result,
    });
  }
}

module.exports = new PrestamoController();
