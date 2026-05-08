'use strict';
const programacionRepository = require('./programacion.repository');
const semestreRepository = require('./programacion.semestre.repository');
const reservasSemestralesRepository = require('../reservas_semestrales/reservas_semestrales.repository');
const ApiError = require('../../shared/errors/api.error');
const { parseExcel, cleanText, cleanDocumento, generateExcel } = require('../../shared/utils/excel.parser');
const { getDiaActual, horaAMinutos } = require('../../shared/utils/date.helper');
const { normalizeDocumento, normalizeString, normalizeUpperString } = require('../../shared/utils/normalize.helper');
const { createLogger } = require('../../shared/utils/logger');

const logger = createLogger('Programacion');

/**
 * Convierte el código raw de semestre del Excel al código normalizado.
 * Formato esperado: PAAAA  donde P=periodo (1 o 2) y AAAA=año (ej: 12026 → 2026-1)
 * @param {string|number} raw
 * @returns {{ codigo: string, anio: number, periodo: number, codigo_raw: string }}
 */
function normalizarCodigoSemestre(raw) {
  const str = String(raw).trim().replace(/\.0$/, '');
  if (!/^\d{5}$/.test(str)) {
    throw ApiError.badRequest(`Código de semestre inválido en el Excel: "${raw}". Se esperaba formato PAAAA (ej: 12026).`);
  }
  const periodo = parseInt(str[0], 10);
  const anio = parseInt(str.slice(1), 10);
  if (periodo < 1 || periodo > 2) {
    throw ApiError.badRequest(`Período de semestre inválido: ${periodo}. Solo se admiten 1 o 2.`);
  }
  return { codigo: `${anio}-${periodo}`, anio, periodo, codigo_raw: str };
}

/**
 * Parsea una fecha del Excel con formato "D/MM/YYYY HH:MM:SS" o "DD/MM/YYYY HH:MM:SS".
 * @param {string|null} str
 * @returns {Date|null}
 */
function parseFechaExcel(str) {
  if (!str) return null;
  const datepart = String(str).trim().split(' ')[0];
  const parts = datepart.split('/');
  if (parts.length !== 3) return null;
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);
  if (Number.isNaN(day) || Number.isNaN(month) || Number.isNaN(year)) return null;
  return new Date(Date.UTC(year, month - 1, day));
}

class ProgramacionService {
  async listar(semestre = null) {
    if (semestre) return programacionRepository.findBySemestre(semestre);
    return programacionRepository.findAll();
  }

  async listarSemestres() {
    return semestreRepository.findAll();
  }

  async listarSemestreVigente() {
    return semestreRepository.findVigente();
  }

  async eliminarSemestre(codigo) {
    const existe = await semestreRepository.findByCodigo(codigo);
    if (!existe) throw ApiError.notFound(`No existe el semestre "${codigo}"`);
    await Promise.all([
      programacionRepository.deleteBySemestre(codigo),
      reservasSemestralesRepository.deleteBySemestre(codigo),
    ]);
    await semestreRepository.deleteByCodigo(codigo);
    logger.info('Semestre eliminado', { codigo });
    return { eliminado: true, codigo };
  }

  async actualizarFechasSemestre(codigo, fecha_inicio_str, fecha_fin_str) {
    const existe = await semestreRepository.findByCodigo(codigo);
    if (!existe) throw ApiError.notFound(`No existe el semestre "${codigo}"`);
    const inicio = new Date(fecha_inicio_str);
    const fin = new Date(fecha_fin_str);
    if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) {
      throw ApiError.badRequest('Fechas inválidas');
    }
    if (inicio >= fin) {
      throw ApiError.badRequest('La fecha de inicio debe ser anterior a la fecha de fin');
    }
    const actualizado = await semestreRepository.updateFechas(codigo, inicio, fin);
    logger.info('Fechas de semestre actualizadas', { codigo, inicio, fin });
    return actualizado;
  }

  async listarPorDia(dia, clasesConLlave = [], semestre = null) {
    const diaFiltro = dia || getDiaActual();
    let semestreFiltro = semestre;
    if (!semestreFiltro) {
      const vigente = await semestreRepository.findVigente();
      semestreFiltro = vigente?.codigo || null;
    }
    const [todasClases, reservasSemestrales] = await Promise.all([
      programacionRepository.findByDia(diaFiltro, semestreFiltro),
      reservasSemestralesRepository.findByDia(diaFiltro, new Date()),
    ]);

    const clases = todasClases.filter((clase) => {
      const doc = normalizeDocumento(clase.numero_documento);
      const horario = normalizeString(clase.horario);
      const yaEntregada = clasesConLlave.some(
        (c) => normalizeDocumento(c.documento) === doc && normalizeString(c.horario) === horario
      );
      return !yaEntregada;
    });

    return { clases, reservasSemestrales };
  }

  async exportar(semestre = null) {
    const registros = semestre
      ? await programacionRepository.findBySemestre(semestre)
      : await programacionRepository.findAll();
    return generateExcel(registros, 'Programacion');
  }

  async importarDesdeExcel(buffer, cargadoPor = '') {
    const rows = parseExcel(buffer);
    if (!rows.length) throw ApiError.badRequest('El archivo Excel está vacío');

    const limpios = this._limpiarProgramacion(rows);
    if (!limpios.length) {
      throw ApiError.badRequest('No se encontraron registros válidos en el archivo');
    }

    // Extraer y validar semestre único del archivo
    const semestresDetectados = [...new Set(limpios.map((r) => r.semestre).filter(Boolean))];
    if (semestresDetectados.length === 0) {
      throw ApiError.badRequest('No se detectó código de semestre en el Excel. Verifique la columna "semestre".');
    }
    if (semestresDetectados.length > 1) {
      throw ApiError.badRequest(
        `El archivo contiene múltiples semestres: ${semestresDetectados.join(', ')}. Importe un semestre a la vez.`
      );
    }

    const semestreCodigo = semestresDetectados[0];

    // Extraer fechas de inicio/fin del semestre (consistentes en todo el archivo)
    const fechasInicio = [...new Set(limpios.map((r) => r._fecha_inicio_raw).filter(Boolean))];
    const fechasFin = [...new Set(limpios.map((r) => r._fecha_fin_raw).filter(Boolean))];

    const fechaInicio = parseFechaExcel(fechasInicio[0] || null);
    const fechaFin = parseFechaExcel(fechasFin[0] || null);

    if (!fechaInicio || !fechaFin) {
      throw ApiError.badRequest('No se encontraron fechas de inicio o fin del semestre en el Excel. Verifique las columnas "fecha_inicio" y "fecha_fin".');
    }
    if (fechaInicio >= fechaFin) {
      throw ApiError.badRequest('La fecha de inicio del semestre debe ser anterior a la fecha de fin.');
    }

    // Limpiar campos internos temporales antes de persistir
    const registrosLimpios = limpios.map(({ _fecha_inicio_raw, _fecha_fin_raw, ...rest }) => ({
      ...rest,
      fecha_inicio_semestre: fechaInicio,
      fecha_fin_semestre: fechaFin,
    }));

    const consolidados = this._unificarHorarios(registrosLimpios);
    logger.info('Importación de programación', {
      filas: rows.length,
      validos: limpios.length,
      consolidados: consolidados.length,
      semestre: semestreCodigo,
    });

    const result = await programacionRepository.bulkInsert(consolidados, semestreCodigo);

    // Upsert metadatos del semestre
    try {
      const meta = normalizarCodigoSemestre(
        limpios.find((r) => r._semestre_raw)?._semestre_raw || semestreCodigo
      );
      await semestreRepository.upsert({
        codigo_raw: meta.codigo_raw,
        codigo: semestreCodigo,
        anio: meta.anio,
        periodo: meta.periodo,
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        fecha_carga: new Date(),
        cargado_por: cargadoPor,
        total_registros: result.insertados,
      });
    } catch (metaErr) {
      logger.warn('No se pudo guardar metadatos del semestre', { error: metaErr.message });
    }

    return {
      insertados: result.insertados,
      semestre: semestreCodigo,
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
    };
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

        // Normalizar el código de semestre y guardar raw para upsert de metadatos
        if (mapped.semestre) {
          try {
            const meta = normalizarCodigoSemestre(mapped.semestre);
            mapped._semestre_raw = meta.codigo_raw;
            mapped.semestre = meta.codigo;
          } catch {
            // si no normaliza, mantener valor original
          }
        }

        // Guardar fechas raw para extraerlas una sola vez en importar
        mapped._fecha_inicio_raw = row['fecha_inicio'] || row['Fecha Inicio'] || null;
        mapped._fecha_fin_raw = row['fecha_fin'] || row['Fecha Fin'] || null;

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
