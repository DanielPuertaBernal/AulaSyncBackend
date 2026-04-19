'use strict';
const configuracionRepository = require('./configuracion.repository');
const bloqueRepository = require('../bloques/bloque.repository');
const ApiError = require('../../shared/errors/api.error');

const DEFAULTS = {
  tiempo_maximo_prestamo_minutos: 120,
  intervalo_recordatorio_minutos: 30,
  max_recordatorios: 5,
  notificaciones_activas: true,
};

class ConfiguracionService {
  async listar() {
    return configuracionRepository.findAll();
  }

  async obtenerPorBloque(nombreBloque) {
    const config = await configuracionRepository.findByBloque(nombreBloque);
    return config || { nombre_bloque: nombreBloque, ...DEFAULTS };
  }

  async obtenerDefaults() {
    return { ...DEFAULTS };
  }

  async guardar(nombreBloque, data) {
    const bloque = await bloqueRepository.findByNombre(nombreBloque);
    if (!bloque) {
      throw ApiError.notFound(`Bloque '${nombreBloque}' no encontrado`);
    }

    const campos = {};
    if (data.tiempo_maximo_prestamo_minutos !== undefined) {
      campos.tiempo_maximo_prestamo_minutos = data.tiempo_maximo_prestamo_minutos;
    }
    if (data.intervalo_recordatorio_minutos !== undefined) {
      campos.intervalo_recordatorio_minutos = data.intervalo_recordatorio_minutos;
    }
    if (data.max_recordatorios !== undefined) {
      campos.max_recordatorios = data.max_recordatorios;
    }
    if (data.notificaciones_activas !== undefined) {
      campos.notificaciones_activas = data.notificaciones_activas;
    }

    return configuracionRepository.upsert(nombreBloque, {
      nombre_bloque: nombreBloque,
      ...campos,
    });
  }

  async eliminar(nombreBloque) {
    const deleted = await configuracionRepository.remove(nombreBloque);
    if (!deleted) {
      throw ApiError.notFound(`Configuración para bloque '${nombreBloque}' no encontrada`);
    }
    return deleted;
  }
}

module.exports = new ConfiguracionService();
