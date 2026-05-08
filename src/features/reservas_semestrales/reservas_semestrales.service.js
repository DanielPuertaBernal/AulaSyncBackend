'use strict';
const reservasSemestralesRepository = require('./reservas_semestrales.repository');
const semestreRepository = require('../programacion/programacion.semestre.repository');
const comunidadRepository = require('../comunidad/comunidad.repository');
const ApiError = require('../../shared/errors/api.error');
const { parseExcel, cleanText, cleanDocumento, generateExcel } = require('../../shared/utils/excel.parser');
const { createLogger } = require('../../shared/utils/logger');

const logger = createLogger('ReservasSemestrales');

/** Mapeo de iniciales de días usadas en el Excel → nombre completo en español */
const MAPA_DIAS = {
  L: 'Lunes',
  M: 'Martes',
  W: 'Miércoles',
  J: 'Jueves',
  V: 'Viernes',
  S: 'Sábado',
  D: 'Domingo',
};

/**
 * Convierte código raw de semestre al código normalizado.
 * Formato PAAAA donde P=periodo (1 o 2) y AAAA=año (ej: 12026 → 2026-1)
 * @param {string|number} raw
 * @returns {string} Código normalizado ej "2026-1"
 */
function normalizarCodigoSemestre(raw) {
  const str = String(raw).trim().replace(/\.0$/, '');
  if (!/^\d{5}$/.test(str)) {
    throw ApiError.badRequest(`Código de semestre inválido: "${raw}". Se esperaba formato PAAAA (ej: 12026).`);
  }
  const periodo = parseInt(str[0], 10);
  const anio = parseInt(str.slice(1), 10);
  if (periodo < 1 || periodo > 2) {
    throw ApiError.badRequest(`Período de semestre inválido: ${periodo}. Solo se admiten 1 o 2.`);
  }
  return `${anio}-${periodo}`;
}

/**
 * Normaliza el string de horario al formato "HH:MM A HH:MM".
 * Acepta: "07:00 -- 15:00", "07:00--15:00", "07:00-15:00", "07:00 A 15:00"
 * @param {string} raw
 * @returns {{ horario: string, hora_inicio: string, hora_fin: string }}
 */
function normalizarHorario(raw) {
  if (!raw) return { horario: '', hora_inicio: '', hora_fin: '' };
  const clean = String(raw).trim().replace(/\s*-{1,2}\s*/g, ' A ').replace(/\s+/g, ' ');
  const partes = clean.split(' A ');
  if (partes.length < 2) return { horario: clean, hora_inicio: partes[0]?.trim() || '', hora_fin: '' };
  const hora_inicio = partes[0].trim();
  const hora_fin = partes[partes.length - 1].trim();
  return { horario: `${hora_inicio} A ${hora_fin}`, hora_inicio, hora_fin };
}

class ReservasSemestralesService {
  /** Lista todas las reservas semestrales de un semestre. */
  async listar(semestre) {
    return reservasSemestralesRepository.findBySemestre(semestre);
  }

  /**
   * Lista reservas semestrales activas para un día específico (del semestre vigente en la fecha dada).
   * @param {string} dia - Nombre del día en español (ej: "Lunes")
   * @param {Date} [fechaHoy]
   * @returns {Promise<object[]>}
   */
  async listarPorDia(dia, fechaHoy = new Date()) {
    return reservasSemestralesRepository.findByDia(dia, fechaHoy);
  }

  /** Elimina todas las reservas semestrales de un semestre. */
  async eliminarPorSemestre(semestre) {
    const result = await reservasSemestralesRepository.deleteBySemestre(semestre);
    logger.info('Reservas semestrales eliminadas', { semestre, result });
    return result;
  }

  /** Exporta las reservas semestrales de un semestre a Excel. */
  async exportar(semestre) {
    const registros = await reservasSemestralesRepository.findBySemestre(semestre);
    const CAMPOS_EXCLUIDOS = ['_id', '__v', 'tipo', 'codigo_materia', 'grupo', 'nivel_grupo', 'estudiantes_prematriculados', 'estudiantes_matriculados', 'total_estudiantes', 'observaciones'];
    const datos = registros.map((r) => {
      const raw = r.toObject ? r.toObject() : { ...r };
      CAMPOS_EXCLUIDOS.forEach((c) => delete raw[c]);
      // Garantizar orden: semestre → consecutivo → resto
      const { semestre: sem, consecutivo, ...resto } = raw;
      return { semestre: sem, consecutivo, ...resto };
    });
    return generateExcel(datos, `Reservas_Semestrales_${semestre}`);
  }

  /**
   * Importa reservas semestrales desde un buffer Excel.
   * Valida que todos los rows pertenezcan al semestre destino.
   * @param {string} codigoSemestre - Código normalizado del semestre destino (ej: "2026-1")
   * @param {Buffer} buffer - Buffer del archivo Excel
   * @param {string} [cargadoPor]
   * @returns {Promise<{insertados: number, semestre: string}>}
   */
  async importarDesdeExcel(codigoSemestre, buffer, cargadoPor = '') {
    // 1. Lookup semestre → fechas
    const semestreMeta = await semestreRepository.findByCodigo(codigoSemestre);
    if (!semestreMeta) {
      throw ApiError.notFound(`No existe el semestre "${codigoSemestre}". Primero importe la programación del semestre.`);
    }
    const { fecha_inicio, fecha_fin } = semestreMeta;

    // 2. Parse Excel
    const rows = parseExcel(buffer);
    if (!rows.length) throw ApiError.badRequest('El archivo Excel está vacío');

    // 3. Limpiar y validar
    const registros = [];
    const erroresSemestre = [];

    for (const row of rows) {
      const semestreRaw = row.semestre ?? row.Semestre ?? null;
      if (semestreRaw !== null && semestreRaw !== undefined && String(semestreRaw).trim() !== '') {
        let codigoRow;
        try {
          codigoRow = normalizarCodigoSemestre(semestreRaw);
        } catch {
          codigoRow = String(semestreRaw).trim();
        }
        if (codigoRow !== codigoSemestre) {
          erroresSemestre.push(`"${semestreRaw}" → "${codigoRow}"`);
        }
      }

      const consecutivo = cleanDocumento(row.consecutivo ?? row.Consecutivo ?? '');
      const aulaRaw = cleanText(row.aula ?? row.Aula ?? '');
      const diaRaw = cleanText(row.dia ?? row.Dia ?? row.Día ?? '');
      const horarioRaw = cleanText(row.horario ?? row.Horario ?? '');
      const responsableRaw = cleanText(row.responsable ?? row.Responsable ?? '');
      const nroidentiRaw = cleanDocumento(
        row.nroidenti ?? row.NroIdenti ?? row.nroIdenti ?? row.numero_documento ?? row['Numero Documento'] ?? row.documento ?? row.Documento ?? ''
      ).trim();
      const nombre_reservaRaw = cleanText(row.nombre_reserva ?? row['Nombre Reserva'] ?? '');
      const i_canceladaRaw = row.i_cancelada ?? row.ICancelada ?? 0;
      const fecha_cancelacionRaw = cleanText(row.fecha_cancelacion ?? row['Fecha Cancelacion'] ?? '');
      const motivo_cancelacionRaw = cleanText(row.motivo_cancelacion ?? row['Motivo Cancelacion'] ?? '');

      // Mapear día
      const diaUpper = diaRaw.toUpperCase().trim();
      const diaNombre = MAPA_DIAS[diaUpper] || diaRaw;

      // Normalizar horario
      const { horario, hora_inicio, hora_fin } = normalizarHorario(horarioRaw);

      registros.push({
        tipo: 'semestral',
        consecutivo,
        aula: aulaRaw,
        dia: diaNombre,
        horario,
        hora_inicio,
        hora_fin,
        /** Campos canónicos comunes — no se duplican en nroidenti/responsable/nombre_reserva */
        numero_documento: nroidentiRaw,
        docente: responsableRaw,
        materia: nombre_reservaRaw,
        semestre: codigoSemestre,
        fecha_inicio_semestre: fecha_inicio,
        fecha_fin_semestre: fecha_fin,
        i_cancelada: Number(i_canceladaRaw) || 0,
        fecha_cancelacion: fecha_cancelacionRaw,
        motivo_cancelacion: motivo_cancelacionRaw,
      });
    }

    // 4. Regla de negocio: no se pueden mezclar semestres
    if (erroresSemestre.length > 0) {
      throw ApiError.badRequest(
        `El archivo contiene reservas de otro semestre: ${[...new Set(erroresSemestre)].join(', ')}. ` +
        `Solo se pueden importar reservas del semestre "${codigoSemestre}".`
      );
    }

    if (!registros.length) {
      throw ApiError.badRequest('No se encontraron registros válidos en el archivo');
    }

    // 5. Cruce de facultad con comunidad (batch lookup)
    const documentosUnicos = [...new Set(registros.map((r) => r.nroidenti).filter(Boolean))];
    const personas = await comunidadRepository.findManyByDocumentos(documentosUnicos);
    const mapaFacultad = Object.fromEntries(
      personas.map((p) => [String(p.numero_documento).trim(), p.facultad || 'No aplica'])
    );
    for (const reg of registros) {
      reg.facultad = mapaFacultad[reg.nroidenti] || 'No aplica';
    }

    logger.info('Importando reservas semestrales', {
      codigoSemestre,
      total: registros.length,
      cargadoPor,
    });

    const result = await reservasSemestralesRepository.bulkInsert(codigoSemestre, registros);
    return { insertados: result.insertados, semestre: codigoSemestre };
  }
}

module.exports = new ReservasSemestralesService();
