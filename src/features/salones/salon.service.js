'use strict';
const salonRepository = require('./salon.repository');
const bloqueRepository = require('../bloques/bloque.repository');

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
      throw Object.assign(new Error(`Ya existe el salón '${payload.nombre_salon}'`), { statusCode: 409 });
    }

    await this._validarBloqueRegistrado(payload.nombre_bloque);

    return salonRepository.create(payload);
  }

  async actualizar(id, updates) {
    const current = await salonRepository.findById(id);
    if (!current) throw Object.assign(new Error('Salón no encontrado'), { statusCode: 404 });

    const payload = this._normalizarPayload(updates, true);

    if (payload.nombre_salon && payload.nombre_salon !== current.nombre_salon) {
      const existing = await salonRepository.findByNombre(payload.nombre_salon);
      if (existing && String(existing._id) !== String(id)) {
        throw Object.assign(new Error(`Ya existe el salón '${payload.nombre_salon}'`), { statusCode: 409 });
      }
    }

    if (payload.nombre_bloque !== undefined) {
      await this._validarBloqueRegistrado(payload.nombre_bloque);
    }

    const updated = await salonRepository.update(id, payload);
    if (!updated) throw Object.assign(new Error('Salón no encontrado'), { statusCode: 404 });
    return updated;
  }

  async eliminar(id) {
    const deleted = await salonRepository.deleteById(id);
    if (!deleted) throw Object.assign(new Error('Salón no encontrado'), { statusCode: 404 });
    return { ok: true };
  }

  _normalizarPayload(data, parcial = false) {
    const payload = { ...data };

    if (payload.nombre_salon !== undefined) {
      payload.nombre_salon = String(payload.nombre_salon || '').trim().toUpperCase();
    }
    if (payload.nombre_bloque !== undefined) {
      payload.nombre_bloque = String(payload.nombre_bloque || '').trim().toUpperCase();
    }
    if (payload.tipo_silleteria !== undefined) {
      payload.tipo_silleteria = String(payload.tipo_silleteria || '').trim();
    }
    if (payload.capacidad_estudiantes !== undefined) {
      payload.capacidad_estudiantes = parseInt(payload.capacidad_estudiantes, 10);
      if (Number.isNaN(payload.capacidad_estudiantes) || payload.capacidad_estudiantes < 1) {
        throw Object.assign(new Error('Capacidad de estudiantes inválida'), { statusCode: 400 });
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
          throw Object.assign(new Error(`Campo '${campo}' requerido`), { statusCode: 400 });
        }
      }
    }

    return payload;
  }

  async _validarBloqueRegistrado(nombreBloque) {
    const bloque = await bloqueRepository.findByNombre(nombreBloque);
    if (!bloque) {
      throw Object.assign(new Error(`El bloque '${nombreBloque}' no está registrado`), { statusCode: 400 });
    }
  }
}

module.exports = new SalonService();
