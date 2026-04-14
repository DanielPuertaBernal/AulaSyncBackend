'use strict';
const bloqueRepository = require('./bloque.repository');
const ApiError = require('../../shared/errors/api.error');
const { normalizeUpperString } = require('../../shared/utils/normalize.helper');
const { createLogger } = require('../../shared/utils/logger');

const logger = createLogger('Bloques');

class BloqueService {
  async listar() {
    return bloqueRepository.findAll();
  }

  async crear({ nombre_bloque }) {
    const nombre = this._normalizarNombre(nombre_bloque);
    const existing = await bloqueRepository.findByNombre(nombre);
    if (existing) {
      throw ApiError.conflict(`Ya existe el bloque '${nombre}'`);
    }
    return bloqueRepository.create({ nombre_bloque: nombre });
  }

  async actualizar(id, { nombre_bloque }) {
    const current = await bloqueRepository.findById(id);
    if (!current) throw ApiError.notFound('Bloque no encontrado');

    const nombre = this._normalizarNombre(nombre_bloque);
    const existing = await bloqueRepository.findByNombre(nombre);
    if (existing && String(existing._id) !== String(id)) {
      throw ApiError.conflict(`Ya existe el bloque '${nombre}'`);
    }

    const updated = await bloqueRepository.update(id, { nombre_bloque: nombre });
    if (!updated) throw ApiError.notFound('Bloque no encontrado');
    return updated;
  }

  async eliminar(id) {
    const deleted = await bloqueRepository.deleteById(id);
    if (!deleted) throw ApiError.notFound('Bloque no encontrado');
    logger.info('Bloque eliminado', { id });
    return { ok: true };
  }

  _normalizarNombre(nombreBloque) {
    const nombre = normalizeUpperString(nombreBloque);
    if (!nombre) {
      throw ApiError.badRequest("Campo 'nombre_bloque' requerido");
    }
    return nombre;
  }
}

module.exports = new BloqueService();
