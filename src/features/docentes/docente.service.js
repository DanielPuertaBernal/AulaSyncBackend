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
        const documento = cleanDocumento(
          row['Numero de documento'] || row['Número de documento'] || row['nroidenti'] || ''
        );
        if (!documento) return null;

        return {
          numero_documento: documento,
          nombre: cleanText(row['Nombre'] || row['nombre'] || row['Docente'] || ''),
          facultad: cleanText(row['Facultad'] || row['facultad'] || row['descripcion'] || ''),
          correo: cleanText(row['Correo'] || row['correo'] || row['email'] || '').toLowerCase(),
          id_carnet: cleanText(row['Id Carnet'] || row['id_carnet'] || row['IdCarnet'] || ''),
        };
      })
      .filter(Boolean);

    if (!docentes.length) {
      throw Object.assign(new Error('No se encontraron docentes válidos en el archivo'), { statusCode: 400 });
    }

    const result = await docenteRepository.bulkUpsert(docentes);
    return { ...result, total: docentes.length };
  }
}

module.exports = new DocenteService();
