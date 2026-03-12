'use strict';
/**
 * Equipo Service
 * Equivale a application/services/equipo_service.py
 * Código de barras: INV-{codigo}-{consecutivo:03d}
 */
const equipoRepository = require('./equipo.repository');

class EquipoService {
  async listar() { return equipoRepository.findAll(); }
  async disponibles() { return equipoRepository.findDisponibles(); }
  async obtener(id) {
    const e = await equipoRepository.findById(id);
    if (!e) throw Object.assign(new Error('Equipo no encontrado'), { statusCode: 404 });
    return e;
  }
  async buscarPorCodigoBarras(cb) {
    const e = await equipoRepository.findByCodigoBarras(cb);
    if (!e) throw Object.assign(new Error('Equipo no encontrado'), { statusCode: 404 });
    return e;
  }

  /**
   * Registra un nuevo equipo
   * Genera código de barras automático: INV-{codigo}-{consecutivo:03d}
   */
  async registrar({ nombre, marca, consecutivo, codigo_inventario, descripcion }) {
    const existing = await equipoRepository.findByCodigo(codigo_inventario);
    if (existing) {
      throw Object.assign(
        new Error(`Ya existe un equipo con código '${codigo_inventario}'`),
        { statusCode: 409 }
      );
    }
    const cons = parseInt(consecutivo, 10);
    const codigoBase = String(codigo_inventario).split('-')[0] || codigo_inventario;
    const codigo_barras = `INV-${codigoBase}-${String(cons).padStart(3, '0')}`;

    return equipoRepository.create({
      nombre: nombre.trim(),
      marca: (marca || '').trim(),
      consecutivo: cons,
      codigo_inventario: codigo_inventario.trim(),
      codigo_barras,
      descripcion: descripcion || '',
    });
  }

  async actualizar(id, datos) {
    const actual = await equipoRepository.findById(id);
    if (!actual) throw Object.assign(new Error('Equipo no encontrado'), { statusCode: 404 });

    const updates = { ...datos };

    if (updates.codigo_inventario) {
      updates.codigo_inventario = String(updates.codigo_inventario).trim();
      if (updates.codigo_inventario !== actual.codigo_inventario) {
        const existing = await equipoRepository.findByCodigo(updates.codigo_inventario);
        if (existing && String(existing._id) !== String(id)) {
          throw Object.assign(
            new Error(`Ya existe un equipo con código '${updates.codigo_inventario}'`),
            { statusCode: 409 }
          );
        }
      }
    }

    if (updates.consecutivo !== undefined) {
      updates.consecutivo = parseInt(updates.consecutivo, 10);
      if (Number.isNaN(updates.consecutivo)) {
        throw Object.assign(new Error('Consecutivo inválido'), { statusCode: 400 });
      }
    }

    const codigoInventarioFinal = updates.codigo_inventario || actual.codigo_inventario;
    const consecutivoFinal = updates.consecutivo !== undefined ? updates.consecutivo : actual.consecutivo;
    if (updates.codigo_inventario || updates.consecutivo !== undefined) {
      const codigoBase = String(codigoInventarioFinal).split('-')[0] || codigoInventarioFinal;
      updates.codigo_barras = `INV-${codigoBase}-${String(consecutivoFinal).padStart(3, '0')}`;
    }

    const updated = await equipoRepository.update(id, updates);
    if (!updated) throw Object.assign(new Error('Equipo no encontrado'), { statusCode: 404 });
    return updated;
  }

  async eliminar(id) {
    const deleted = await equipoRepository.deleteById(id);
    if (!deleted) throw Object.assign(new Error('Equipo no encontrado'), { statusCode: 404 });
    return { ok: true };
  }

  estaDisponible(equipo) { return equipo.estado === 'activo'; }
}

module.exports = new EquipoService();
