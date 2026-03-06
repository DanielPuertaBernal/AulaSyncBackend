'use strict';
/**
 * Docente Service
 * Equivale a application/services/docente_service.py + infrastructure/importers/docente_excel_importer.py
 */
const docenteRepository = require('./docente.repository');
const { parseExcel, cleanText, cleanDocumento } = require('../../shared/utils/excel.parser');

class DocenteService {
  async listar() {
    return docenteRepository.findAll();
  }

  async buscarPorDocumento(documento) {
    const doc = await docenteRepository.findByDocumento(String(documento).replace('.0', ''));
    if (!doc) throw Object.assign(new Error('Docente no encontrado'), { statusCode: 404 });
    return doc;
  }

  async buscarPorCarnet(idCarnet) {
    const doc = await docenteRepository.findByCarnet(idCarnet);
    if (!doc) throw Object.assign(new Error('Docente no encontrado por carnet'), { statusCode: 404 });
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
    if (!rows.length) throw Object.assign(new Error('El archivo Excel está vacío'), { statusCode: 400 });

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
      throw Object.assign(new Error('No se encontraron docentes válidos en el archivo'), { statusCode: 400 });
    }

    const result = await docenteRepository.bulkUpsert(docentes);
    return { ...result, total: docentes.length };
  }

  // Normaliza los keys del row: lowercase, sin tildes, trimmed
  _normalizarColumnas(row) {
    const normalized = {};
    for (const [key, value] of Object.entries(row)) {
      const clean = key
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
      normalized[clean] = value;
    }
    return normalized;
  }
}

module.exports = new DocenteService();
