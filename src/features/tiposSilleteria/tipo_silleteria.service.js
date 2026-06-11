'use strict';
const tipoSilleteriaRepository = require('./tipo_silleteria.repository');
const ApiError = require('../../shared/errors/api.error');
const { normalizeUpperString } = require('../../shared/utils/normalize.helper');
const { createLogger } = require('../../shared/utils/logger');

const logger = createLogger('TiposSilleteria');

class TipoSilleteriaService {
  async listar() {
    return tipoSilleteriaRepository.findAll();
  }

  async crear({ nombre }) {
    const normalizado = this._normalizar(nombre);
    const existing = await tipoSilleteriaRepository.findByNombre(normalizado);
    if (existing) throw ApiError.conflict(`Ya existe el tipo '${normalizado}'`);
    return tipoSilleteriaRepository.create({ nombre: normalizado });
  }

  async actualizar(id, { nombre }) {
    const current = await tipoSilleteriaRepository.findById(id);
    if (!current) throw ApiError.notFound('Tipo de silletería no encontrado');

    const normalizado = this._normalizar(nombre);
    const existing = await tipoSilleteriaRepository.findByNombre(normalizado);
    if (existing && String(existing._id) !== String(id)) {
      throw ApiError.conflict(`Ya existe el tipo '${normalizado}'`);
    }

    const updated = await tipoSilleteriaRepository.update(id, { nombre: normalizado });
    if (!updated) throw ApiError.notFound('Tipo de silletería no encontrado');
    return updated;
  }

  async eliminar(id) {
    const deleted = await tipoSilleteriaRepository.deleteById(id);
    if (!deleted) throw ApiError.notFound('Tipo de silletería no encontrado');
    logger.info('Tipo de silletería eliminado', { id });
    return { ok: true };
  }

  _normalizar(nombre) {
    const n = normalizeUpperString(nombre);
    if (!n) throw ApiError.badRequest("Campo 'nombre' requerido");
    return n;
  }
}

module.exports = new TipoSilleteriaService();
