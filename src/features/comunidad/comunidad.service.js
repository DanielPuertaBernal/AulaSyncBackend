'use strict';
const comunidadRepository = require('./comunidad.repository');
const ApiError = require('../../shared/errors/api.error');
const { normalizeDocumento } = require('../../shared/utils/normalize.helper');
const { TIPOS_COMUNIDAD } = require('./comunidad.schema');

class ComunidadService {
  async listar(tipo) {
    const filtro = tipo ? { tipo } : {};
    return comunidadRepository.findAll(filtro);
  }

  async buscarPorDocumento(documento) {
    const persona = await comunidadRepository.findByDocumento(normalizeDocumento(documento));
    if (!persona) throw ApiError.notFound('Persona no encontrada');
    return persona;
  }

  async buscarPorCarnet(idCarnet) {
    const persona = await comunidadRepository.findByCarnet(idCarnet);
    if (!persona) throw ApiError.notFound('Persona no encontrada por carnet');
    return persona;
  }

  async buscar(query, tipo) {
    const filtro = tipo ? { tipo } : {};
    return comunidadRepository.search(query, filtro);
  }

  async sync(payload) {
    const registros = Array.isArray(payload.registros)
      ? payload.registros
      : payload.registro
        ? [payload.registro]
        : [];

    if (!registros.length) {
      throw ApiError.badRequest('Debe enviar al menos un registro (campo "registro" o "registros")');
    }

    const validados = registros.map((r, i) => this._validarRegistro(r, i));

    if (validados.length === 1) {
      const persona = await comunidadRepository.upsertOne(validados[0]);
      return { sincronizados: 1, detalle: persona };
    }

    const resultado = await comunidadRepository.upsertMany(validados);
    return { sincronizados: validados.length, ...resultado };
  }

  _validarRegistro(r, idx) {
    if (!r.numero_documento?.trim()) {
      throw ApiError.badRequest(`Registro ${idx}: numero_documento es requerido`);
    }
    if (!r.nombre?.trim()) {
      throw ApiError.badRequest(`Registro ${idx}: nombre es requerido`);
    }
    if (!r.tipo || !TIPOS_COMUNIDAD.includes(r.tipo)) {
      throw ApiError.badRequest(
        `Registro ${idx}: tipo debe ser uno de: ${TIPOS_COMUNIDAD.join(', ')}`
      );
    }

    return {
      numero_documento: String(r.numero_documento).trim(),
      nombre: String(r.nombre).trim(),
      tipo: r.tipo,
      facultad: String(r.facultad || '').trim(),
      correo: String(r.correo || '').trim().toLowerCase(),
      id_carnet: String(r.id_carnet || '').trim(),
    };
  }
}

module.exports = new ComunidadService();
