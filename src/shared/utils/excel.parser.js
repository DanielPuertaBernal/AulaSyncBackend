'use strict';
/**
 * Excel Parser - Reemplaza pandas/openpyxl de Python
 * Lee archivos Excel y retorna arrays de objetos
 */
const XLSX = require('xlsx');

/**
 * Parsea un buffer o path de Excel y retorna array de objetos
 * @param {Buffer|string} input - Buffer del archivo o path
 * @param {object} options
 * @param {number} [options.headerRow=1] - Fila donde están los encabezados (1-indexed)
 * @param {string} [options.sheet] - Nombre de la hoja (default: primera hoja)
 * @returns {Array<object>}
 */
function parseExcel(input, options = {}) {
  const workbook = typeof input === 'string'
    ? XLSX.readFile(input)
    : XLSX.read(input, { type: 'buffer' });

  const sheetName = options.sheet || workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  if (!worksheet) {
    throw new Error(`Hoja "${sheetName}" no encontrada en el archivo`);
  }

  const rows = XLSX.utils.sheet_to_json(worksheet, {
    defval: null,
    raw: false, // convierte números a string para fechas/horas
  });

  return rows;
}

/**
 * Limpia texto de caracteres especiales (equivale a ProgramacionCleaner.limpiar_texto)
 * @param {*} value
 * @returns {string}
 */
function cleanText(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/_x000D_/g, '')
    .replace(/\r/g, '')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Limpia número de documento (elimina .0 al final)
 * @param {*} doc
 * @returns {string}
 */
function cleanDocumento(doc) {
  if (doc === null || doc === undefined) return '';
  const str = String(doc);
  return str.endsWith('.0') ? str.slice(0, -2) : str;
}

/**
 * Genera un buffer Excel desde un array de objetos (reemplaza pandas to_excel)
 * @param {Array<object>} data
 * @param {string} [sheetName='Hoja1']
 * @returns {Buffer}
 */
function generateExcel(data, sheetName = 'Hoja1') {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

/**
 * Genera un buffer Excel con múltiples hojas.
 * @param {Array<{name: string, data: Array<object>}>} sheets
 * @returns {Buffer}
 */
function generateExcelMultiSheet(sheets) {
  const workbook = XLSX.utils.book_new();
  for (const { name, data } of sheets) {
    const worksheet = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, worksheet, name);
  }
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

module.exports = { parseExcel, cleanText, cleanDocumento, generateExcel, generateExcelMultiSheet };
