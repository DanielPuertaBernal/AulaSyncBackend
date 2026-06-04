'use strict';
const salonRepository = require('./salon.repository');
const bloqueRepository = require('../bloques/bloque.repository');
const programacionRepository = require('../programacion/programacion.repository');
const ApiError = require('../../shared/errors/api.error');
const {
  normalizeAula,
  normalizeString,
  normalizeUpperString,
} = require('../../shared/utils/normalize.helper');
const { createLogger } = require('../../shared/utils/logger');

const logger = createLogger('Salones');

class SalonService {
  async listar() {
    return salonRepository.findAll();
  }

  async registrar({ nombre_salon, nombre_bloque, capacidad_estudiantes, tipo_silleteria }) {
    const payload = this._normalizarPayload({
      nombre_salon,
      nombre_bloque,
      capacidad_estudiantes,
      tipo_silleteria,
    });

    const existing = await salonRepository.findByNombre(payload.nombre_salon);
    if (existing) {
      throw ApiError.conflict(`Ya existe el salón '${payload.nombre_salon}'`);
    }

    await this._validarBloqueRegistrado(payload.nombre_bloque);

    return salonRepository.create(payload);
  }

  async actualizar(id, updates) {
    const current = await salonRepository.findById(id);
    if (!current) throw ApiError.notFound('Salón no encontrado');

    const payload = this._normalizarPayload(updates, true);

    if (payload.nombre_salon && payload.nombre_salon !== current.nombre_salon) {
      const existing = await salonRepository.findByNombre(payload.nombre_salon);
      if (existing && String(existing._id) !== String(id)) {
        throw ApiError.conflict(`Ya existe el salón '${payload.nombre_salon}'`);
      }
    }

    if (payload.nombre_bloque !== undefined) {
      await this._validarBloqueRegistrado(payload.nombre_bloque);
    }

    const updated = await salonRepository.update(id, payload);
    if (!updated) throw ApiError.notFound('Salón no encontrado');
    return updated;
  }

  async eliminar(id) {
    const deleted = await salonRepository.deleteById(id);
    if (!deleted) throw ApiError.notFound('Salón no encontrado');
    logger.info('Salón eliminado', { id });
    return { ok: true };
  }

  _normalizarPayload(data, parcial = false) {
    const payload = { ...data };

    if (payload.nombre_salon !== undefined) {
      payload.nombre_salon = normalizeAula(payload.nombre_salon);
    }
    if (payload.nombre_bloque !== undefined) {
      payload.nombre_bloque = normalizeUpperString(payload.nombre_bloque);
    }
    if (payload.tipo_silleteria !== undefined) {
      payload.tipo_silleteria = normalizeString(payload.tipo_silleteria);
    }
    if (payload.capacidad_estudiantes !== undefined) {
      payload.capacidad_estudiantes = parseInt(payload.capacidad_estudiantes, 10);
      if (Number.isNaN(payload.capacidad_estudiantes) || payload.capacidad_estudiantes < 1) {
        throw ApiError.badRequest('Capacidad de estudiantes inválida');
      }
    }

    if (!parcial) {
      const required = ['nombre_salon', 'nombre_bloque', 'capacidad_estudiantes', 'tipo_silleteria'];
      for (const campo of required) {
        if (
          payload[campo] === undefined ||
          payload[campo] === null ||
          (typeof payload[campo] === 'string' && !payload[campo].trim())
        ) {
          throw ApiError.badRequest(`Campo '${campo}' requerido`);
        }
      }
    }

    return payload;
  }

  async aulasDeProgSinRegistrar() {
    const [aulasEnProg, salones] = await Promise.all([
      programacionRepository.distinctAulas(),
      salonRepository.findAll(),
    ]);
    const registrados = new Set(salones.map((s) => s.nombre_salon));
    return aulasEnProg.filter((a) => a && !registrados.has(a)).sort();
  }

  async _validarBloqueRegistrado(nombreBloque) {
    const bloque = await bloqueRepository.findByNombre(nombreBloque);
    if (!bloque) {
      throw ApiError.badRequest(`El bloque '${nombreBloque}' no está registrado`);
    }
  }
}

module.exports = new SalonService();
