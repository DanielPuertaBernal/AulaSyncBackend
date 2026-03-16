'use strict';
const bloqueRepository = require('./bloque.repository');

class BloqueService {
  async listar() {
    return bloqueRepository.findAll();
  }

  async crear({ nombre_bloque }) {
    const nombre = this._normalizarNombre(nombre_bloque);
    const existing = await bloqueRepository.findByNombre(nombre);
    if (existing) {
      throw Object.assign(new Error(`Ya existe el bloque '${nombre}'`), { statusCode: 409 });
    }
    return bloqueRepository.create({ nombre_bloque: nombre });
  }

  async actualizar(id, { nombre_bloque }) {
    const current = await bloqueRepository.findById(id);
    if (!current) throw Object.assign(new Error('Bloque no encontrado'), { statusCode: 404 });

    const nombre = this._normalizarNombre(nombre_bloque);
    const existing = await bloqueRepository.findByNombre(nombre);
    if (existing && String(existing._id) !== String(id)) {
      throw Object.assign(new Error(`Ya existe el bloque '${nombre}'`), { statusCode: 409 });
    }

    const updated = await bloqueRepository.update(id, { nombre_bloque: nombre });
    if (!updated) throw Object.assign(new Error('Bloque no encontrado'), { statusCode: 404 });
    return updated;
  }

  async eliminar(id) {
    const deleted = await bloqueRepository.deleteById(id);
    if (!deleted) throw Object.assign(new Error('Bloque no encontrado'), { statusCode: 404 });
    return { ok: true };
  }

  _normalizarNombre(nombreBloque) {
    const nombre = String(nombreBloque || '').trim().toUpperCase();
    if (!nombre) {
      throw Object.assign(new Error("Campo 'nombre_bloque' requerido"), { statusCode: 400 });
    }
    return nombre;
  }
}

module.exports = new BloqueService();
