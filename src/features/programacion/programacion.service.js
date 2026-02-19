'use strict';
/**
 * Programacion Service
 * Equivale a: application/services/programacion_service.py
 *           + application/processing/programacion_cleaner.py
 *           + infrastructure/importers/programacion_excel_importer.py
 */
const programacionRepository = require('./programacion.repository');
const { parseExcel, cleanText, cleanDocumento, generateExcel } = require('../../shared/utils/excel.parser');
const { getDiaActual, horaAMinutos } = require('../../shared/utils/date.helper');

const GAP_MINIMO_MINUTOS = 30;

class ProgramacionService {
  async listar() {
    return programacionRepository.findAll();
  }

  /**
   * Clases del día indicado, filtrando las que ya pasaron su horario y
   * las que tienen llave entregada (requiere lista de clases procesadas)
   * @param {string} [dia] - Nombre del día (default: hoy)
   * @param {object[]} [clasesConLlave] - clases con llave activa { documento, horario }
   * @returns {Promise<object[]>}
   */
  async listarPorDia(dia, clasesConLlave = []) {
    const diaFiltro = dia || getDiaActual();
    const clases = await programacionRepository.findByDia(diaFiltro);

    const ahora = new Date();
    const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes();

    return clases.filter((clase) => {
      // Filtrar las que ya terminaron
      const horaFin = horaAMinutos(clase['Hora Fin']);
      if (horaFin !== null && horaFin < minutosAhora) return false;

      // Filtrar las que ya tienen llave entregada
      const doc = String(clase['Número de Documento']).replace('.0', '');
      const horario = String(clase['Horario'] || '').trim();
      const yaEntregada = clasesConLlave.some(
        (c) => String(c.documento).replace('.0', '') === doc && String(c.horario).trim() === horario
      );
      return !yaEntregada;
    });
  }

  /**
   * Exporta toda la programación como buffer XLSX
   * @returns {Buffer}
   */
  async exportar() {
    const registros = await programacionRepository.findAll();
    return generateExcel(registros, 'Programacion');
  }

  /**
   * Importa programación desde Excel
   * Equivale a ProgramacionCleaner.limpiar_programacion + ProgramacionExcelImporter
   * @param {Buffer} buffer
   * @returns {Promise<{insertados: number}>}
   */
  async importarDesdeExcel(buffer) {
    const rows = parseExcel(buffer);
    if (!rows.length) throw Object.assign(new Error('El archivo Excel está vacío'), { statusCode: 400 });

    const limpios = this._limpiarProgramacion(rows);
    if (!limpios.length) {
      throw Object.assign(new Error('No se encontraron registros válidos en el archivo'), { statusCode: 400 });
    }

    return programacionRepository.bulkInsert(limpios);
  }

  /**
   * Limpia y transforma filas crudas del Excel
   * Equivale a ProgramacionCleaner.limpiar_programacion (Python)
   * @param {object[]} rows
   * @returns {object[]}
   */
  _limpiarProgramacion(rows) {
    const MAPEO = {
      'nroidenti': 'Número de Documento',
      'Número de Documento': 'Número de Documento',
      'profesor': 'Docente',
      'Docente': 'Docente',
      'dia': 'Día',
      'Día': 'Día',
      'horario': 'Horario',
      'Horario': 'Horario',
      'hora_ini': 'Hora Inicio',
      'Hora Inicio': 'Hora Inicio',
      'hora_fin': 'Hora Fin',
      'Hora Fin': 'Hora Fin',
      'aula': 'Aula',
      'Aula': 'Aula',
      'descripcion': 'Facultad',
      'Facultad': 'Facultad',
      'descripcion.1': 'Materia de la Clase',
      'Materia de la Clase': 'Materia de la Clase',
      'materia': 'Código de la Materia',
      'Código de la Materia': 'Código de la Materia',
      'grupo': 'Grupo',
      'Grupo': 'Grupo',
      'nivel_grupo': 'Nivel del Grupo',
      'Nivel del Grupo': 'Nivel del Grupo',
      'nro_estudiantes_premat': 'Estudiantes Prematriculados',
      'nro_estudiantes': 'Estudiantes Matriculados',
      'total_estudiantes': 'Total de Estudiantes',
    };

    return rows
      .map((row) => {
        const mapped = {};
        for (const [src, dest] of Object.entries(MAPEO)) {
          if (row[src] !== undefined && row[src] !== null) {
            mapped[dest] = row[src];
          }
        }

        // Documento limpio
        const documento = cleanDocumento(mapped['Número de Documento'] || '');
        if (!documento) return null;
        mapped['Número de Documento'] = documento;

        // Limpiar textos
        ['Docente', 'Día', 'Aula', 'Facultad', 'Materia de la Clase', 'Horario'].forEach((k) => {
          if (mapped[k]) mapped[k] = cleanText(mapped[k]);
        });

        // Normalizar horario si solo existe Hora Inicio y Hora Fin
        if (!mapped['Horario'] && mapped['Hora Inicio'] && mapped['Hora Fin']) {
          mapped['Horario'] = `${mapped['Hora Inicio']} A ${mapped['Hora Fin']}`;
        }

        // Separar horario si existe en campo "Horario"
        if (mapped['Horario'] && (!mapped['Hora Inicio'] || !mapped['Hora Fin'])) {
          const [ini, fin] = String(mapped['Horario']).toUpperCase().split(' A ');
          if (ini) mapped['Hora Inicio'] = ini.trim();
          if (fin) mapped['Hora Fin'] = fin.trim();
        }

        // Normalizar horas (redondear minutos 1-9 → 0)
        mapped['Hora Inicio'] = this._normalizarMinutos(mapped['Hora Inicio']);
        mapped['Hora Fin'] = this._normalizarMinutos(mapped['Hora Fin']);

        // Números
        mapped['Estudiantes Prematriculados'] = parseInt(mapped['Estudiantes Prematriculados'], 10) || 0;
        mapped['Estudiantes Matriculados'] = parseInt(mapped['Estudiantes Matriculados'], 10) || 0;
        mapped['Total de Estudiantes'] =
          (mapped['Estudiantes Prematriculados'] + mapped['Estudiantes Matriculados']) || 0;

        return mapped;
      })
      .filter(Boolean)
      .filter((r) => this._esRegistroValido(r));
  }

  /**
   * Normaliza minutos 1-9 → 0 (ej: 07:05 → 07:00)
   * @param {string} hora  "HH:MM"
   */
  _normalizarMinutos(hora) {
    if (!hora) return hora;
    const parts = String(hora).split(':');
    if (parts.length < 2) return hora;
    const min = parseInt(parts[1], 10);
    if (min >= 1 && min <= 9) {
      return `${parts[0].padStart(2, '0')}:00`;
    }
    return hora;
  }

  /**
   * Verifica que el registro tenga los campos mínimos necesarios
   */
  _esRegistroValido(r) {
    return !!(r['Número de Documento'] && r['Docente'] && r['Día'] && r['Aula']);
  }
}

module.exports = new ProgramacionService();
