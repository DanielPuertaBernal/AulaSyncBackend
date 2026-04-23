'use strict';
const reservaService = require('./reserva.service');
const { parsePagination } = require('../../shared/utils/pagination.helper');

class ReservaController {
  async validar(req, res) {
    const result = await reservaService.validar(req.body);
    return res.json({ ok: true, data: result });
  }

  async crear(req, res) {
    const datos = {
      ...req.body,
      creado_por_rol: req.user?.rol || '',
    };
    const reserva = await reservaService.crear(datos);
    return res.status(201).json({ ok: true, data: reserva });
  }

  async listar(req, res) {
    const { nombre_bloque, nombre_salon, estado, fecha, busqueda, page, limit } = req.query;
    const pagination = parsePagination({ page, limit });
    const result = await reservaService.listar(
      { nombre_bloque, nombre_salon, estado, fecha, busqueda },
      pagination
    );
    if (pagination) {
      return res.json({ ok: true, data: result.data, meta: result.meta });
    }
    return res.json({ ok: true, data: result.data || result });
  }

  async aprobar(req, res) {
    const aprobadoPor = req.user?.nombre || req.user?.usuario || '';
    const reserva = await reservaService.aprobar(req.params.id, aprobadoPor);
    return res.json({ ok: true, data: reserva });
  }

  async rechazar(req, res) {
    const aprobadoPor = req.user?.nombre || req.user?.usuario || '';
    const reserva = await reservaService.rechazar(req.params.id, aprobadoPor);
    return res.json({ ok: true, data: reserva });
  }

  async cancelar(req, res) {
    const reserva = await reservaService.cancelar(req.params.id);
    return res.json({ ok: true, data: reserva });
  }

  async disponibilidad(req, res) {
    const { nombre_salon, fecha } = req.query;
    if (!nombre_salon || !fecha) {
      return res.status(400).json({ ok: false, message: 'nombre_salon y fecha son requeridos' });
    }
    const data = await reservaService.disponibilidad(nombre_salon, fecha);
    return res.json({ ok: true, data });
  }

  async disponibilidadSmart(req, res) {
    const { nombre_salon, fecha } = req.query;
    if (!nombre_salon || !fecha) {
      return res.status(400).json({ ok: false, message: 'nombre_salon y fecha son requeridos' });
    }
    const data = await reservaService.disponibilidadSmart(nombre_salon, fecha);
    return res.json({ ok: true, data });
  }
}

module.exports = new ReservaController();
