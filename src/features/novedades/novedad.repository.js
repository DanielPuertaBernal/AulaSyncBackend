'use strict';
const { Novedad } = require('./novedad.schema');
const { applyPagination } = require('../../shared/utils/pagination.helper');

class NovedadRepository {
  async create(data) {
    return Novedad.create(data);
  }

  async findById(id) {
    return Novedad.findById(id).lean();
  }

  async updateById(id, updates) {
    return Novedad.findByIdAndUpdate(id, { $set: updates }, { new: true }).lean();
  }

  async findHistorial(filters = {}, pagination = null) {
    const query = {};
    if (filters.tipo_recurso) query.tipo_recurso = filters.tipo_recurso;
    if (filters.estado) query.estado = filters.estado;
    if (filters.categoria) query.categoria = filters.categoria;
    if (filters.reportado_por) query.reportado_por = filters.reportado_por;
    if (filters.busqueda) {
      const escaped = String(filters.busqueda).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      query.$or = [
        { reportado_por: regex },
        { reportado_por_nombre: regex },
        { salon: regex },
        { descripcion: regex },
      ];
    }
    if (filters.desde || filters.hasta) {
      query.fecha_reporte = {};
      if (filters.desde) query.fecha_reporte.$gte = new Date(`${filters.desde}T00:00:00`);
      if (filters.hasta) query.fecha_reporte.$lte = new Date(`${filters.hasta}T23:59:59.999`);
    }
    return applyPagination(Novedad.find(query).sort({ fecha_reporte: -1 }), pagination);
  }

  async estadisticas() {
    const [porEstado, porCategoria, porTipo] = await Promise.all([
      Novedad.aggregate([{ $group: { _id: '$estado', total: { $sum: 1 } } }]),
      Novedad.aggregate([{ $group: { _id: '$categoria', total: { $sum: 1 } } }]),
      Novedad.aggregate([{ $group: { _id: '$tipo_recurso', total: { $sum: 1 } } }]),
    ]);

    const mapReduce = (arr) => arr.reduce((acc, r) => ({ ...acc, [r._id]: r.total }), {});
    return {
      por_estado: mapReduce(porEstado),
      por_categoria: mapReduce(porCategoria),
      por_tipo: mapReduce(porTipo),
      total: porEstado.reduce((s, r) => s + r.total, 0),
    };
  }
}

module.exports = new NovedadRepository();
