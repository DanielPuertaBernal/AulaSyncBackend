'use strict';
const programacionRepository = require('./programacion.repository');
const ApiError = require('../../shared/errors/api.error');
const { parseExcel, cleanText, cleanDocumento, generateExcel } = require('../../shared/utils/excel.parser');
const { getDiaActual, horaAMinutos } = require('../../shared/utils/date.helper');
const { normalizeDocumento, normalizeString, normalizeUpperString } = require('../../shared/utils/normalize.helper');
const { createLogger } = require('../../shared/utils/logger');

const logger = createLogger('Programacion');

class ProgramacionService {
  async listar() {
    return programacionRepository.findAll();
  }

  async listarPorDia(dia, clasesConLlave = []) {
    const diaFiltro = dia || getDiaActual();
    const clases = await programacionRepository.findByDia(diaFiltro);

    return clases.filter((clase) => {
      const doc = normalizeDocumento(clase.numero_documento);
      const horario = normalizeString(clase.horario);
      const yaEntregada = clasesConLlave.some(
        (c) => normalizeDocumento(c.documento) === doc && normalizeString(c.horario) === horario
      );
      return !yaEntregada;
    });
  }

  async exportar() {
    const registros = await programacionRepository.findAll();
    return generateExcel(registros, 'Programacion');
  }

  async importarDesdeExcel(buffer) {
    const rows = parseExcel(buffer);
    if (!rows.length) throw ApiError.badRequest('El archivo Excel está vacío');

    const limpios = this._limpiarProgramacion(rows);
    if (!limpios.length) {
      throw ApiError.badRequest('No se encontraron registros válidos en el archivo');
    }

    const consolidados = this._unificarHorarios(limpios);
    logger.info('Importación de programación', { filas: rows.length, validos: limpios.length, consolidados: consolidados.length });
    return programacionRepository.bulkInsert(consolidados);
  }

  /**
   * Limpia y normaliza filas del Excel mapeando columnas al schema interno.
   * @param {Array<Object>} rows - Filas crudas del Excel
   * @returns {Array<Object>} Registros válidos normalizados
   */
  _limpiarProgramacion(rows) {
    const MAPEO = {
      'nroidenti': 'numero_documento',
      'Número de Documento': 'numero_documento',
      'profesor': 'docente',
      'Docente': 'docente',
      'dia': 'dia',
      'Día': 'dia',
      'horario': 'horario',
      'Horario': 'horario',
      'hora_ini': 'hora_inicio',
      'Hora Inicio': 'hora_inicio',
      'hora_fin': 'hora_fin',
      'Hora Fin': 'hora_fin',
      'aula': 'aula',
      'Aula': 'aula',
      'descripcion': 'facultad',
      'Facultad': 'facultad',
      'descripcion_1': 'materia',
      'Materia de la Clase': 'materia',
      'Código de la Materia': 'codigo_materia',
      'materia': 'codigo_materia',
      'grupo': 'grupo',
      'Grupo': 'grupo',
      'nivel_grupo': 'nivel_grupo',
      'Nivel del Grupo': 'nivel_grupo',
      'nro_estudiantes_premat': 'estudiantes_prematriculados',
      'nro_estudiantes': 'estudiantes_matriculados',
      'total_estudiantes': 'total_estudiantes',
      'semestre': 'semestre',
      'Semestre': 'semestre',
    };

    return rows
      .map((row) => {
        const mapped = {};
        for (const [src, dest] of Object.entries(MAPEO)) {
          if (row[src] !== undefined && row[src] !== null) {
            mapped[dest] = row[src];
          }
        }

        const documento = cleanDocumento(mapped.numero_documento || '');
        if (!documento) return null;
        mapped.numero_documento = documento;

        ['docente', 'dia', 'aula', 'facultad', 'materia', 'horario'].forEach((k) => {
          if (mapped[k]) mapped[k] = cleanText(mapped[k]);
        });

        if (!mapped.horario && mapped.hora_inicio && mapped.hora_fin) {
          mapped.horario = `${mapped.hora_inicio} A ${mapped.hora_fin}`;
        }

        if (mapped.horario && (!mapped.hora_inicio || !mapped.hora_fin)) {
          const [ini, fin] = String(mapped.horario).toUpperCase().split(' A ');
          if (ini) mapped.hora_inicio = ini.trim();
          if (fin) mapped.hora_fin = fin.trim();
        }

        mapped.hora_inicio = this._normalizarMinutos(mapped.hora_inicio);
        mapped.hora_fin = this._normalizarMinutos(mapped.hora_fin);

        mapped.estudiantes_prematriculados = parseInt(mapped.estudiantes_prematriculados, 10) || 0;
        mapped.estudiantes_matriculados = parseInt(mapped.estudiantes_matriculados, 10) || 0;
        mapped.total_estudiantes =
          (mapped.estudiantes_prematriculados + mapped.estudiantes_matriculados) || 0;

        return mapped;
      })
      .filter(Boolean)
      .filter((r) => this._esRegistroValido(r));
  }

  /** Redondea minutos 1-9 a :00 (ej: 7:05 → 7:00). */
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

  /** Valida que un registro tenga los campos mínimos requeridos. */
  _esRegistroValido(r) {
    return !!(r.numero_documento && r.docente && r.dia && r.aula);
  }

  /**
   * Consolida bloques horarios consecutivos del mismo docente/aula/materia en un solo registro.
   * @param {Array<Object>} registros - Registros limpios
   * @returns {Array<Object>} Registros con horarios unificados
   */
  _unificarHorarios(registros) {
    const CAMPOS_AGRUPACION = [
      'semestre', 'codigo_materia', 'grupo', 'nivel_grupo',
      'numero_documento', 'dia', 'aula', 'facultad',
    ];

    const grupos = new Map();
    for (const reg of registros) {
      const clave = CAMPOS_AGRUPACION.map((c) => normalizeUpperString(reg[c])).join('|');
      if (!grupos.has(clave)) grupos.set(clave, []);
      grupos.get(clave).push(reg);
    }

    const resultado = [];

    for (const bloques of grupos.values()) {
      bloques.sort((a, b) => {
        const minA = horaAMinutos(a.hora_inicio || '00:00') ?? 0;
        const minB = horaAMinutos(b.hora_inicio || '00:00') ?? 0;
        return minA - minB;
      });

      let actual = { ...bloques[0] };

      for (let i = 1; i < bloques.length; i++) {
        const siguiente = bloques[i];
        const finActual = horaAMinutos(actual.hora_fin || '00:00');
        const inicioSiguiente = horaAMinutos(siguiente.hora_inicio || '00:00');

        if (finActual !== null && inicioSiguiente !== null && finActual === inicioSiguiente) {
          actual.hora_fin = siguiente.hora_fin;
          actual.horario = `${actual.hora_inicio} A ${actual.hora_fin}`;
          actual.estudiantes_prematriculados = Math.max(
            actual.estudiantes_prematriculados || 0,
            siguiente.estudiantes_prematriculados || 0,
          );
          actual.estudiantes_matriculados = Math.max(
            actual.estudiantes_matriculados || 0,
            siguiente.estudiantes_matriculados || 0,
          );
          actual.total_estudiantes = Math.max(
            actual.total_estudiantes || 0,
            siguiente.total_estudiantes || 0,
          );
        } else {
          resultado.push(actual);
          actual = { ...siguiente };
        }
      }

      resultado.push(actual);
    }

    return resultado;
  }
}

module.exports = new ProgramacionService();
