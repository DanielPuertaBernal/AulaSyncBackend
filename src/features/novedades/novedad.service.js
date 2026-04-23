'use strict';
const novedadRepository = require('./novedad.repository');
const { createLogger } = require('../../shared/utils/logger');

const logger = createLogger('Novedades');

class NovedadService {
  async registrar(datos) {
    const novedad = await novedadRepository.create(datos);
    logger.info('Novedad registrada', {
      id: novedad._id,
      tipo: datos.tipo_recurso,
      categoria: datos.categoria,
    });
    return novedad;
  }

  async listar(filters, pagination) {
    return novedadRepository.findHistorial(filters, pagination);
  }

  async obtenerPorId(id) {
    const novedad = await novedadRepository.findById(id);
    if (!novedad) {
      const ApiError = require('../../shared/errors/api.error');
      throw ApiError.notFound('Novedad no encontrada');
    }
    return novedad;
  }

  async actualizarEstado(id, estado, resolucion) {
    const novedad = await novedadRepository.findById(id);
    if (!novedad) {
      const ApiError = require('../../shared/errors/api.error');
      throw ApiError.notFound('Novedad no encontrada');
    }

    const updates = { estado };
    if (resolucion !== undefined) updates.resolucion = resolucion;
    if (estado === 'resuelta' || estado === 'cerrada') {
      updates.fecha_resolucion = new Date();
    }

    const updated = await novedadRepository.updateById(id, updates);
    logger.info('Novedad actualizada', { id, estado });
    return updated;
  }

  async estadisticas() {
    return novedadRepository.estadisticas();
  }
}

module.exports = new NovedadService();
