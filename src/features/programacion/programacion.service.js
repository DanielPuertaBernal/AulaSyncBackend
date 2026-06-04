'use strict';
const programacionRepository = require('./programacion.repository');
const semestreRepository = require('./programacion.semestre.repository');
const reservasSemestralesRepository = require('../reservas_semestrales/reservas_semestrales.repository');
const ApiError = require('../../shared/errors/api.error');
const { parseExcel, cleanText, cleanDocumento, generateExcel, generateExcelMultiSheet } = require('../../shared/utils/excel.parser');
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
  // Si XLSX entregó un Date object directamente
  if (str instanceof Date) return Number.isNaN(str.getTime()) ? null : str;
  const datepart = String(str).trim().split(' ')[0]; // descarta parte de hora
  const parts = datepart.split('/');
  if (parts.length !== 3) return null;
  let a = parseInt(parts[0], 10);
  let b = parseInt(parts[1], 10);
  let c = parseInt(parts[2], 10);
  if (Number.isNaN(a) || Number.isNaN(b) || Number.isNaN(c)) return null;
  // XLSX con raw:false devuelve años de 2 dígitos (ej: 26 → 2026)
  if (c < 100) c += 2000;
  // Detectar orden día/mes:
  //   a > 12 → a es día, b es mes  (DD/MM/YYYY o D/M/YY)
  //   b > 12 → b es día, a es mes  (MM/DD/YYYY o M/D/YY  ← formato XLSX)
  //   ambos ≤ 12 → ambiguo, usar convención DD/MM local
  let day, month;
  if (a > 12)      { day = a; month = b; }
  else if (b > 12) { day = b; month = a; }
  else             { day = a; month = b; }
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return new Date(Date.UTC(c, month - 1, day));
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
    // deleteBySemestre en programacion borra TODO el semestre (clases + semestrales)
    await programacionRepository.deleteBySemestre(codigo);
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
    const { modifiedCount } = await programacionRepository.updateFechasPorSemestre(codigo, inicio, fin);
    logger.info('Fechas de semestre actualizadas', { codigo, inicio, fin, programacionActualizada: modifiedCount });
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
    const CAMPOS_EXCLUIDOS_PROG = ['_id', '__v', 'tipo', 'consecutivo', 'i_cancelada', 'fecha_cancelacion', 'motivo_cancelacion'];
    const CAMPOS_EXCLUIDOS_SEM = ['_id', '__v', 'tipo'];

    const [registrosProg, registrosSem] = await Promise.all([
      semestre ? programacionRepository.findBySemestre(semestre) : programacionRepository.findAll(),
      semestre ? reservasSemestralesRepository.findBySemestre(semestre) : reservasSemestralesRepository.findAll(),
    ]);

    const datosProg = registrosProg.map((r) => {
      const obj = r.toObject ? r.toObject() : { ...r };
      CAMPOS_EXCLUIDOS_PROG.forEach((c) => delete obj[c]);
      return obj;
    });

    const datosSem = registrosSem.map((r) => {
      const obj = r.toObject ? r.toObject() : { ...r };
      CAMPOS_EXCLUIDOS_SEM.forEach((c) => delete obj[c]);
      return obj;
    });

    return generateExcelMultiSheet([
      { name: 'Programacion', data: datosProg },
      { name: 'Semestrales', data: datosSem },
    ]);
  }

  async importarDesdeExcel(buffer, cargadoPor = '') {
    const rows = parseExcel(buffer);
    if (!rows.length) throw ApiError.badRequest('El archivo Excel está vacío');

    const { validos: limpios, rechazados } = this._limpiarProgramacion(rows);
    if (!limpios.length) {
      const porMotivo = {};
      for (const r of rechazados) porMotivo[r.motivo] = (porMotivo[r.motivo] || 0) + 1;
      const detalles = Object.entries(porMotivo)
        .map(([motivo, n]) => `${n} fila(s) ${motivo}`)
        .join('; ');
      const colsDetectadas = rows.length
        ? Object.keys(rows[0]).slice(0, 10).join(', ')
        : 'ninguna';
      throw ApiError.badRequest(
        `No se encontraron registros válidos en el archivo (${rows.length} filas revisadas). ` +
        `${detalles || 'No se reconocieron las columnas'}. ` +
        `Columnas detectadas: [${colsDetectadas}].`
      );
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
      let codigoRaw = semestreCodigo;
      let anio = 0;
      let periodo = 0;

      const rawCode = limpios.find((r) => r._semestre_raw)?._semestre_raw;
      if (rawCode) {
        try {
          const meta = normalizarCodigoSemestre(rawCode);
          codigoRaw = meta.codigo_raw;
          anio = meta.anio;
          periodo = meta.periodo;
        } catch { /* mantener defaults */ }
      } else {
        // Código ya normalizado: "YYYY-P" (ej: "2026-2")
        const parts = semestreCodigo.split('-');
        if (parts.length === 2) {
          anio = parseInt(parts[0], 10) || 0;
          periodo = parseInt(parts[1], 10) || 0;
        }
      }

      await semestreRepository.upsert({
        codigo_raw: codigoRaw,
        codigo: semestreCodigo,
        anio,
        periodo,
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
      'numero_documento': 'numero_documento',
      'Número de Documento': 'numero_documento',
      'profesor': 'docente',
      'docente': 'docente',
      'Docente': 'docente',
      'dia': 'dia',
      'Día': 'dia',
      'horario': 'horario',
      'Horario': 'horario',
      'hora_ini': 'hora_inicio',
      'hora_inicio': 'hora_inicio',
      'Hora Inicio': 'hora_inicio',
      'hora_fin': 'hora_fin',
      'Hora Fin': 'hora_fin',
      'aula': 'aula',
      'Aula': 'aula',
      'descripcion': 'facultad',
      'facultad': 'facultad',
      'Facultad': 'facultad',
      'descripcion_1': 'materia',
      'descripcion2': 'materia',
      'materia': 'codigo_materia',
      'Materia de la Clase': 'materia',
      'codigo_materia': 'codigo_materia',
      'Código de la Materia': 'codigo_materia',
      'grupo': 'grupo',
      'Grupo': 'grupo',
      'nivel_grupo': 'nivel_grupo',
      'Nivel del Grupo': 'nivel_grupo',
      'nro_estudiantes_premat': 'estudiantes_prematriculados',
      'estudiantes_prematriculados': 'estudiantes_prematriculados',
      'nro_estudiantes': 'estudiantes_matriculados',
      'estudiantes_matriculados': 'estudiantes_matriculados',
      'total_estudiantes': 'total_estudiantes',
      'semestre': 'semestre',
      'Semestre': 'semestre',
    };

    const validos = [];
    const rechazados = [];

    for (const row of rows) {
      const mapped = {};
      for (const [src, dest] of Object.entries(MAPEO)) {
        if (row[src] !== undefined && row[src] !== null) {
          mapped[dest] = row[src];
        }
      }

      const documento = cleanDocumento(mapped.numero_documento || '');
      if (!documento) {
        // Si no tiene documento pero sí tiene aula, se incluye con valor por defecto
        if (!mapped.aula) {
          rechazados.push({ motivo: `sin número de documento válido (valor: "${mapped.numero_documento ?? ''}")` });
          continue;
        }
        mapped.numero_documento = 'N/A';
      } else {
        mapped.numero_documento = documento;
      }

      ['docente', 'dia', 'aula', 'facultad', 'materia', 'horario'].forEach((k) => {
        if (mapped[k]) mapped[k] = cleanText(mapped[k]);
      });

      // Normalizar nombre de aula: quitar guiones (ej: "M-303" → "M303", "CO-303" → "CO303")
      if (mapped.aula) mapped.aula = mapped.aula.replace(/-/g, '');

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
      mapped._fecha_inicio_raw = row['fecha_inicio'] || row['Fecha Inicio'] || row['fecha_inicio_semestre'] || null;
      mapped._fecha_fin_raw = row['fecha_fin'] || row['Fecha Fin'] || row['fecha_fin_semestre'] || null;
      mapped.tipo = 'programacion';

      // Si tiene salón pero sin docente asignado, se incluye con valor por defecto
      if (!mapped.docente) mapped.docente = 'No asignado';

      const faltantes = [];
      if (!mapped.dia) faltantes.push('día');
      if (!mapped.aula) faltantes.push('aula');

      if (faltantes.length) {
        rechazados.push({ motivo: `con campo(s) requerido(s) vacíos: ${faltantes.join(', ')}` });
      } else {
        validos.push(mapped);
      }
    }

    return { validos, rechazados };
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
