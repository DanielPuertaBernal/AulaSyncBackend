'use strict';
/**
 * Equipo Service
 * Equivale a application/services/equipo_service.py
 * Código de barras: INV-{codigo}-{consecutivo:03d}
 */
const equipoRepository = require('./equipo.repository');
const ApiError = require('../../shared/errors/api.error');
const { normalizeString } = require('../../shared/utils/normalize.helper');
const { createLogger } = require('../../shared/utils/logger');

const logger = createLogger('Equipos');

class EquipoService {
  async listar() { return equipoRepository.findAll(); }
  async disponibles() { return equipoRepository.findDisponibles(); }
  async obtener(id) {
    const e = await equipoRepository.findById(id);
    if (!e) throw ApiError.notFound('Equipo no encontrado');
    return e;
  }
  async buscarPorCodigoBarras(cb) {
    const e = await equipoRepository.findByCodigoBarras(cb);
    if (!e) throw ApiError.notFound('Equipo no encontrado');
    return e;
  }

  async buscarPorTexto(q) {
    if (!q || String(q).trim().length < 2) throw ApiError.badRequest('El parámetro q debe tener al menos 2 caracteres');
    return equipoRepository.searchByText(String(q).trim());
  }

  /**
   * Registra un nuevo equipo
   * Genera código de barras automático: INV-{codigo}-{consecutivo:03d}
   */
  async registrar({ nombre, marca, consecutivo, codigo_inventario, descripcion }) {
    const existing = await equipoRepository.findByCodigo(codigo_inventario);
    if (existing) {
      throw ApiError.conflict(`Ya existe un equipo con código '${codigo_inventario}'`);
    }
    const cons = parseInt(consecutivo, 10);
    const codigoBase = String(codigo_inventario).split('-')[0] || codigo_inventario;
    const codigo_barras = `INV-${codigoBase}-${String(cons).padStart(3, '0')}`;

    return equipoRepository.create({
      nombre: normalizeString(nombre),
      marca: normalizeString(marca),
      consecutivo: cons,
      codigo_inventario: normalizeString(codigo_inventario),
      codigo_barras,
      descripcion: normalizeString(descripcion),
    });
  }

  async actualizar(id, datos) {
    logger.debug('Actualizando equipo', { id });
    const actual = await equipoRepository.findById(id);
    if (!actual) throw ApiError.notFound('Equipo no encontrado');

    const updates = { ...datos };

    if (updates.codigo_inventario) {
      updates.codigo_inventario = String(updates.codigo_inventario).trim();
      if (updates.codigo_inventario !== actual.codigo_inventario) {
        const existing = await equipoRepository.findByCodigo(updates.codigo_inventario);
        if (existing && String(existing._id) !== String(id)) {
          throw ApiError.conflict(`Ya existe un equipo con código '${updates.codigo_inventario}'`);
        }
      }
    }

    if (updates.consecutivo !== undefined) {
      updates.consecutivo = parseInt(updates.consecutivo, 10);
      if (Number.isNaN(updates.consecutivo)) {
        throw ApiError.badRequest('Consecutivo inválido');
      }
    }

    const codigoInventarioFinal = updates.codigo_inventario || actual.codigo_inventario;
    const consecutivoFinal = updates.consecutivo !== undefined ? updates.consecutivo : actual.consecutivo;
    if (updates.codigo_inventario || updates.consecutivo !== undefined) {
      const codigoBase = String(codigoInventarioFinal).split('-')[0] || codigoInventarioFinal;
      updates.codigo_barras = `INV-${codigoBase}-${String(consecutivoFinal).padStart(3, '0')}`;
    }

    const updated = await equipoRepository.update(id, updates);
    if (!updated) throw ApiError.notFound('Equipo no encontrado');
    return updated;
  }

  async eliminar(id) {
    const deleted = await equipoRepository.deleteById(id);
    if (!deleted) throw ApiError.notFound('Equipo no encontrado');
    return { ok: true };
  }
}

module.exports = new EquipoService();
