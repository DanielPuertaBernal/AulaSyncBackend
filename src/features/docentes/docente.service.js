'use strict';
/**
 * Docente Service
 * Equivale a application/services/docente_service.py + infrastructure/importers/docente_excel_importer.py
 */
const docenteRepository = require('./docente.repository');
const ApiError = require('../../shared/errors/api.error');
const { parseExcel, cleanText, cleanDocumento } = require('../../shared/utils/excel.parser');
const { normalizeDocumento, normalizeLookupKey } = require('../../shared/utils/normalize.helper');

class DocenteService {
  async listar() {
    return docenteRepository.findAll();
  }

  async buscarPorDocumento(documento) {
    const doc = await docenteRepository.findByDocumento(normalizeDocumento(documento));
    if (!doc) throw ApiError.notFound('Docente no encontrado');
    return doc;
  }

  async buscarPorCarnet(idCarnet) {
    const doc = await docenteRepository.findByCarnet(idCarnet);
    if (!doc) throw ApiError.notFound('Docente no encontrado por carnet');
    return doc;
  }

  async buscar(query) {
    return docenteRepository.search(query);
  }

  /**
   * Importa docentes desde un buffer de Excel
   * Equivale a infrastructure/importers/docente_excel_importer.py
   * @param {Buffer} buffer
   * @returns {Promise<{insertados: number, actualizados: number, total: number}>}
   */
  async importarDesdeExcel(buffer) {
    const rows = parseExcel(buffer);
    if (!rows.length) throw ApiError.badRequest('El archivo Excel está vacío');

    const docentes = rows
      .map((row) => {
        const r = this._normalizarColumnas(row);
        const documento = cleanDocumento(r['numero de documento'] || r['nroidenti'] || '');
        if (!documento) return null;

        return {
          numero_documento: documento,
          nombre: cleanText(r['nombre'] || r['docente'] || ''),
          facultad: cleanText(r['facultad'] || r['descripcion'] || ''),
          correo: cleanText(r['correo'] || r['email'] || '').toLowerCase(),
          id_carnet: cleanText(r['id carnet'] || r['id_carnet'] || r['idcarnet'] || ''),
        };
      })
      .filter(Boolean);

    if (!docentes.length) {
      throw ApiError.badRequest('No se encontraron docentes válidos en el archivo');
    }

    const result = await docenteRepository.bulkUpsert(docentes);
    return { ...result, total: docentes.length };
  }

  // Normaliza los keys del row: lowercase, sin tildes, trimmed
  _normalizarColumnas(row) {
    const normalized = {};
    for (const [key, value] of Object.entries(row)) {
      const clean = normalizeLookupKey(key);
      normalized[clean] = value;
    }
    return normalized;
  }
}

module.exports = new DocenteService();
