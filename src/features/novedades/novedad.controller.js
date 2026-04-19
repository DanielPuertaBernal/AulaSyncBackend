'use strict';
const novedadService = require('./novedad.service');
const { parsePagination } = require('../../shared/utils/pagination.helper');

class NovedadController {
  async registrar(req, res) {
    const datos = {
      ...req.body,
      reportado_por: req.body.reportado_por || req.user?.documento || '',
      reportado_por_nombre: req.body.reportado_por_nombre || req.user?.nombre || '',
    };
    const novedad = await novedadService.registrar(datos);
    return res.status(201).json({ ok: true, data: novedad });
  }

  async listar(req, res) {
    const { tipo_recurso, estado, categoria, busqueda, desde, hasta, page, limit } = req.query;
    const pagination = parsePagination({ page, limit });
    const result = await novedadService.listar(
      { tipo_recurso, estado, categoria, busqueda, desde, hasta },
      pagination
    );
    if (pagination) {
      return res.json({ ok: true, data: result.data, meta: result.meta });
    }
    return res.json({ ok: true, data: result.data || result });
  }

  async obtener(req, res) {
    const novedad = await novedadService.obtenerPorId(req.params.id);
    return res.json({ ok: true, data: novedad });
  }

  async actualizarEstado(req, res) {
    const { estado, resolucion } = req.body;
    const novedad = await novedadService.actualizarEstado(req.params.id, estado, resolucion);
    return res.json({ ok: true, data: novedad });
  }

  async estadisticas(_req, res) {
    const data = await novedadService.estadisticas();
    return res.json({ ok: true, data });
  }
}

module.exports = new NovedadController();
