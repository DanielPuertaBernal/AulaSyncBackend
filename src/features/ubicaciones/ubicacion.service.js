'use strict';
const ubicacionRepository = require('./ubicacion.repository');
const ApiError = require('../../shared/errors/api.error');
const { normalizeKey, normalizeString } = require('../../shared/utils/normalize.helper');
const {
  UBICACIONES,
  OPERACIONES_UBICACION,
} = require('../../shared/constants/nfc.constants');

const DEFAULT_UBICACIONES = Object.freeze([
  {
    clave: UBICACIONES.OFICINA,
    nombre: 'Oficina Centro de Servicios Docentes',
    descripcion: 'Punto principal para identificación, préstamos y devoluciones.',
    activa: true,
    permite_identificacion: true,
    permite_prestamo_llaves: true,
    permite_devolucion_llaves: true,
    permite_prestamo_equipos: true,
    creado_por: 'system',
    actualizado_por: 'system',
  },
  {
    clave: UBICACIONES.PORTERIA_SUPERIOR,
    nombre: 'Portería Superior',
    descripcion: 'Punto habilitado para devoluciones de llaves mediante NFC.',
    activa: true,
    permite_identificacion: false,
    permite_prestamo_llaves: false,
    permite_devolucion_llaves: true,
    permite_prestamo_equipos: false,
    creado_por: 'system',
    actualizado_por: 'system',
  },
]);

const OPERACION_A_CAMPO = Object.freeze({
  [OPERACIONES_UBICACION.IDENTIFICACION]: 'permite_identificacion',
  [OPERACIONES_UBICACION.PRESTAMO_LLAVES]: 'permite_prestamo_llaves',
  [OPERACIONES_UBICACION.DEVOLUCION_LLAVES]: 'permite_devolucion_llaves',
  [OPERACIONES_UBICACION.PRESTAMO_EQUIPOS]: 'permite_prestamo_equipos',
});

class UbicacionService {
  constructor() {
    this._defaultsReadyPromise = null;
  }

  async asegurarIniciales() {
    if (!this._defaultsReadyPromise) {
      this._defaultsReadyPromise = ubicacionRepository.upsertDefaults(DEFAULT_UBICACIONES)
        .catch((error) => {
          this._defaultsReadyPromise = null;
          throw error;
        });
    }

    await this._defaultsReadyPromise;
  }

  async listar({ incluirInactivas = false } = {}) {
    await this.asegurarIniciales();
    return ubicacionRepository.findAll({ soloActivas: !incluirInactivas });
  }

  async obtenerPorClave(clave, { permitirInactiva = false } = {}) {
    await this.asegurarIniciales();
    const normalizada = this._normalizarClave(clave);
    const ubicacion = await ubicacionRepository.findByClave(normalizada);
    if (!ubicacion) {
      throw ApiError.notFound(`La ubicación '${normalizada}' no está registrada`);
    }
    if (!permitirInactiva && !ubicacion.activa) {
      throw ApiError.badRequest(`La ubicación '${ubicacion.nombre}' está inactiva`);
    }
    return ubicacion;
  }

  async registrar(data, actor = '') {
    await this.asegurarIniciales();
    const payload = this._normalizarPayload(data);
    const existing = await ubicacionRepository.findByClave(payload.clave);
    if (existing) {
      throw ApiError.conflict(`Ya existe una ubicación con la clave '${payload.clave}'`);
    }

    return ubicacionRepository.create({
      ...payload,
      creado_por: actor || payload.creado_por || '',
      actualizado_por: actor || payload.actualizado_por || '',
    });
  }

  async actualizar(id, updates, actor = '') {
    await this.asegurarIniciales();
    const current = await ubicacionRepository.findById(id);
    if (!current) throw ApiError.notFound('Ubicación no encontrada');

    const payload = this._normalizarPayload(updates, true);
    if (payload.clave && payload.clave !== current.clave) {
      const existing = await ubicacionRepository.findByClave(payload.clave);
      if (existing && String(existing._id) !== String(id)) {
        throw ApiError.conflict(`Ya existe una ubicación con la clave '${payload.clave}'`);
      }
    }

    const updated = await ubicacionRepository.update(id, {
      ...payload,
      actualizado_por: actor || current.actualizado_por || '',
    });
    if (!updated) throw ApiError.notFound('Ubicación no encontrada');
    return updated;
  }

  async eliminar(id) {
    await this.asegurarIniciales();
    const deleted = await ubicacionRepository.deleteById(id);
    if (!deleted) throw ApiError.notFound('Ubicación no encontrada');
    return { ok: true };
  }

  async validarOperacion(clave, operacion) {
    const ubicacion = await this.obtenerPorClave(clave);
    const campoPermiso = OPERACION_A_CAMPO[operacion];
    if (!campoPermiso) {
      throw new ApiError('Operación de ubicación no soportada', 500);
    }
    if (!ubicacion[campoPermiso]) {
      throw ApiError.badRequest(`La ubicación '${ubicacion.nombre}' no permite la operación solicitada`);
    }
    return ubicacion.clave;
  }

  _normalizarPayload(data, parcial = false) {
    const payload = { ...data };

    if (payload.clave !== undefined) payload.clave = this._normalizarClave(payload.clave);
    if (payload.nombre !== undefined) payload.nombre = normalizeString(payload.nombre);
    if (payload.descripcion !== undefined) payload.descripcion = normalizeString(payload.descripcion);

    for (const campo of [
      'activa',
      'permite_identificacion',
      'permite_prestamo_llaves',
      'permite_devolucion_llaves',
      'permite_prestamo_equipos',
    ]) {
      if (payload[campo] !== undefined) {
        payload[campo] = Boolean(payload[campo]);
      }
    }

    if (!parcial) {
      for (const campo of ['clave', 'nombre']) {
        if (!payload[campo]) {
          throw ApiError.badRequest(`Campo '${campo}' requerido`);
        }
      }
    }

    return payload;
  }

  _normalizarClave(clave) {
    const normalizada = normalizeKey(clave);

    if (!normalizada) {
      throw ApiError.badRequest('Clave de ubicación requerida');
    }

    return normalizada;
  }
}

module.exports = new UbicacionService();
