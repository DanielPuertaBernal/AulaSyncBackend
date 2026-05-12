'use strict';
const crypto = require('crypto');
const reservasSemestralesRepository = require('./reservas_semestrales.repository');
const semestreRepository = require('../programacion/programacion.semestre.repository');
const comunidadRepository = require('../comunidad/comunidad.repository');
const { Programacion } = require('../programacion/programacion.schema');
const { Salon } = require('../salones/salon.schema');
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

  /**
   * Retorna los slots de 30 min (07:00–22:00) con disponibilidad para un salón y día del semestre vigente.
   * @param {string} nombre_salon
   * @param {string} dia - Nombre completo del día en español (ej: "Lunes")
   * @returns {Promise<{slots: Array<{hora: string, disponible: boolean, motivo?: string, detalle?: string}>}>}
   */
  async disponibilidadPorDia(nombre_salon, dia) {
    const vigente = await semestreRepository.findVigente();
    if (!vigente) throw ApiError.notFound('No hay semestre vigente');

    // Programación regular del salón ese día
    const progRegular = await Programacion.find({
      tipo: 'programacion',
      aula: nombre_salon,
      dia: new RegExp(dia, 'i'),
      semestre: vigente.codigo,
    }).lean();

    // Reservas semestrales activas del salón ese día
    const semestrales = await reservasSemestralesRepository.findByAulaDia(nombre_salon, dia, vigente.codigo);

    // Generar slots 07:00–22:00 cada 30 min
    const slots = [];
    for (let h = 7; h < 22; h++) {
      for (const m of [0, 30]) {
        const hora = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        const horaFin = m === 30
          ? `${String(h + 1).padStart(2, '0')}:00`
          : `${String(h).padStart(2, '0')}:30`;

        const conflictoRegular = progRegular.find(
          (p) => p.hora_inicio && p.hora_fin && p.hora_inicio <= hora && p.hora_fin > hora
        );
        const conflictoSemestral = semestrales.find(
          (s) => s.hora_inicio && s.hora_fin && s.hora_inicio <= hora && s.hora_fin > hora
        );

        if (conflictoRegular) {
          slots.push({ hora, disponible: false, motivo: 'programacion', detalle: `${conflictoRegular.docente || ''} — ${conflictoRegular.materia || ''} (${conflictoRegular.hora_inicio}–${conflictoRegular.hora_fin})` });
        } else if (conflictoSemestral) {
          slots.push({ hora, disponible: false, motivo: 'semestral', detalle: `${conflictoSemestral.docente || ''} — ${conflictoSemestral.materia || ''} (${conflictoSemestral.hora_inicio}–${conflictoSemestral.hora_fin})` });
        } else {
          slots.push({ hora, disponible: true });
        }
      }
    }
    return { slots, semestre: vigente.codigo };
  }

  /**
   * Valida si una franja horaria tiene conflictos con programación regular o semestrales activas.
   * @param {object} params
   * @param {string} params.nombre_salon
   * @param {string} params.dia
   * @param {string} params.hora_inicio
   * @param {string} params.hora_fin
   * @param {string} [params.excluir_grupo_id]
   * @param {string} [params.semestre]
   */
  async validarConflictos({ nombre_salon, dia, hora_inicio, hora_fin, excluir_grupo_id, semestre }) {
    const codigoSemestre = semestre || (await semestreRepository.findVigente())?.codigo;
    if (!codigoSemestre) throw ApiError.notFound('No hay semestre vigente');

    const conflictos = [];

    const progRegular = await Programacion.find({
      tipo: 'programacion',
      aula: nombre_salon,
      dia: new RegExp(dia, 'i'),
      semestre: codigoSemestre,
    }).lean();

    for (const p of progRegular) {
      if (p.hora_inicio && p.hora_fin && p.hora_inicio < hora_fin && p.hora_fin > hora_inicio) {
        conflictos.push({ tipo: 'programacion', detalle: `${p.docente || ''} — ${p.materia || ''} (${p.hora_inicio}–${p.hora_fin})` });
      }
    }

    const queryS = { tipo: 'semestral', aula: nombre_salon, dia: new RegExp(dia, 'i'), semestre: codigoSemestre, i_cancelada: { $ne: 1 } };
    if (excluir_grupo_id) queryS.grupo_id = { $ne: excluir_grupo_id };
    const semestrales = await Programacion.find(queryS).lean();

    for (const s of semestrales) {
      if (s.hora_inicio && s.hora_fin && s.hora_inicio < hora_fin && s.hora_fin > hora_inicio) {
        conflictos.push({ tipo: 'semestral', detalle: `${s.docente || ''} — ${s.materia || ''} (${s.hora_inicio}–${s.hora_fin})` });
      }
    }

    return { tiene_conflictos: conflictos.length > 0, conflictos };
  }

  /**
   * Retorna los salones sin conflicto durante dia+hora en el semestre vigente.
   * @param {string} dia
   * @param {string} hora_inicio
   * @param {string} hora_fin
   */
  async salonesDisponibles(dia, hora_inicio, hora_fin) {
    const vigente = await semestreRepository.findVigente();
    if (!vigente) throw ApiError.notFound('No hay semestre vigente');

    const overlapQuery = { hora_inicio: { $lt: hora_fin }, hora_fin: { $gt: hora_inicio } };
    const [ocupadosProg, ocupadosSem] = await Promise.all([
      Programacion.distinct('aula', {
        tipo: 'programacion',
        dia: new RegExp(dia, 'i'),
        semestre: vigente.codigo,
        ...overlapQuery,
      }),
      Programacion.distinct('aula', {
        tipo: 'semestral',
        dia: new RegExp(dia, 'i'),
        semestre: vigente.codigo,
        i_cancelada: { $ne: 1 },
        ...overlapQuery,
      }),
    ]);

    const ocupados = new Set([...ocupadosProg, ...ocupadosSem]);
    const todos = await Salon.find().sort({ nombre_bloque: 1, nombre_salon: 1 }).lean();
    const disponibles = todos.filter((s) => !ocupados.has(s.nombre_salon));
    return { salones: disponibles, semestre: vigente.codigo };
  }

  /**
   * Crea manualmente un conjunto de reservas semestrales (una por franja).
   */
  async crearManual(datos) {
    const vigente = await semestreRepository.findVigente();
    if (!vigente) throw ApiError.notFound('No hay semestre vigente activo para asignar la reserva');

    // Buscar facultad del solicitante
    const persona = await comunidadRepository.findByDocumento(datos.solicitante_documento);
    const facultad = persona?.facultad || 'No aplica';

    // Validar conflictos por franja
    const conflictosPorFranja = [];
    for (const franja of datos.franjas) {
      const { tiene_conflictos, conflictos } = await this.validarConflictos({
        nombre_salon: datos.nombre_salon,
        dia: franja.dia,
        hora_inicio: franja.hora_inicio,
        hora_fin: franja.hora_fin,
        semestre: vigente.codigo,
      });
      if (tiene_conflictos) {
        conflictosPorFranja.push({ franja, conflictos });
      }
    }

    if (conflictosPorFranja.length > 0 && !datos.forzar) {
      throw ApiError.conflict('Existen conflictos en las franjas seleccionadas', { conflictosPorFranja });
    }

    const grupo_id = crypto.randomUUID();

    const docs = datos.franjas.map((franja) => ({
      tipo: 'semestral',
      semestre: vigente.codigo,
      fecha_inicio_semestre: vigente.fecha_inicio,
      fecha_fin_semestre: vigente.fecha_fin,
      numero_documento: datos.solicitante_documento,
      docente: datos.solicitante_nombre,
      dia: franja.dia,
      hora_inicio: franja.hora_inicio,
      hora_fin: franja.hora_fin,
      horario: `${franja.hora_inicio} A ${franja.hora_fin}`,
      aula: datos.nombre_salon,
      nombre_bloque: datos.nombre_bloque,
      materia: datos.materia,
      facultad,
      i_cancelada: 0,
      grupo_id,
      creado_manualmente: true,
      tipo_solicitante: datos.tipo_solicitante,
      ...(datos.responsable_documento ? { responsable_documento: datos.responsable_documento } : {}),
      ...(datos.responsable_nombre ? { responsable_nombre: datos.responsable_nombre } : {}),
    }));

    await Programacion.insertMany(docs);
    logger.info('Reservas semestrales manuales creadas', { grupo_id, semestre: vigente.codigo, franjas: datos.franjas.length });
    return { grupo_id, insertados: docs.length, semestre: vigente.codigo };
  }

  /**
   * Lista todas las reservas semestrales (todos los semestres), agrupadas por grupo_id cuando aplica.
   */
  async listarTodas() {
    const todas = await reservasSemestralesRepository.findAll();
    // Agrupa las que tienen grupo_id; los sin grupo_id se devuelven tal cual
    const grupos = {};
    const sinGrupo = [];

    for (const r of todas) {
      if (r.grupo_id) {
        if (!grupos[r.grupo_id]) {
          grupos[r.grupo_id] = { ...r, _franjas: [{ dia: r.dia, hora_inicio: r.hora_inicio, hora_fin: r.hora_fin, horario: r.horario }] };
        } else {
          grupos[r.grupo_id]._franjas.push({ dia: r.dia, hora_inicio: r.hora_inicio, hora_fin: r.hora_fin, horario: r.horario });
        }
      } else {
        sinGrupo.push(r);
      }
    }

    const agrupadas = Object.values(grupos);
    return [...agrupadas, ...sinGrupo];
  }

  /**
   * Cancela (elimina) todas las franjas de un grupo manual.
   * @param {string} grupo_id
   */
  async cancelarGrupo(grupo_id) {
    const doc = await reservasSemestralesRepository.findOneByGrupoId(grupo_id);
    if (!doc) throw ApiError.notFound(`No se encontró el grupo "${grupo_id}"`);
    if (!doc.creado_manualmente) throw ApiError.forbidden('Solo se pueden cancelar reservas creadas manualmente');
    const result = await reservasSemestralesRepository.deleteByGrupoId(grupo_id);
    logger.info('Grupo de reservas semestrales cancelado', { grupo_id, eliminados: result.deletedCount });
    return { eliminados: result.deletedCount };
  }
}

module.exports = new ReservasSemestralesService();
