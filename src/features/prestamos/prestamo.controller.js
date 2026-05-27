'use strict';
const prestamoService = require('./prestamo.service');

class PrestamoController {
  /** GET /api/prestamos */
  async listar(req, res) {
    const prestamos = await prestamoService.listar();
    return res.json({ ok: true, data: { prestamos } });
  }
  /** GET /api/prestamos/activos */
  async activos(req, res) {
    const prestamos = await prestamoService.activos();
    return res.json({ ok: true, data: { prestamos } });
  }
  /** GET /api/prestamos/docente/:nfc */
  async porDocente(req, res) {
    const prestamos = await prestamoService.porDocente(req.params.nfc);
    return res.json({ ok: true, data: { prestamos } });
  }
  /** POST /api/prestamos */
  async crear(req, res) {
    const prestamo = await prestamoService.crear({
      ...req.body,
      auxiliar_prestamista: req.body.auxiliar_prestamista || req.user.nombre,
    });
    return res.status(201).json({ ok: true, message: 'Préstamo creado', data: { prestamo } });
  }
  /** PATCH /api/prestamos/:id/equipo */
  async agregarEquipo(req, res) {
    const { equipoId } = req.body;
    const prestamo = await prestamoService.agregarEquipo(req.params.id, equipoId, req.user.nombre);
    return res.json({ ok: true, message: 'Equipo agregado al préstamo', data: { prestamo } });
  }
  /** POST /api/prestamos/devolucion */
  async devolucion(req, res) {
    const result = await prestamoService.registrarDevolucion({
      ...req.body,
      auxiliar_que_recibio: req.body.auxiliar_que_recibio || req.user.nombre,
    });

    // Si se reportó una novedad junto con la devolución, crearla
    if (req.body?.novedad && req.body.novedad.categoria) {
      const novedadService = require('../novedades/novedad.service');
      await novedadService.registrar({
        tipo_recurso: 'equipo',
        recurso_id: req.body.prestamo_id,
        prestamo_ref: req.body.prestamo_id,
        reportado_por: req.user.sub,
        reportado_por_nombre: req.user?.nombre || 'Auxiliar',
        salon: '',
        categoria: req.body.novedad.categoria,
        descripcion: req.body.novedad.descripcion || '',
      });
    }

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
