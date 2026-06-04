'use strict';
const crypto = require('crypto');
const reservasSemestralesRepository = require('./reservas_semestrales.repository');
const semestreRepository = require('../programacion/programacion.semestre.repository');
const comunidadRepository = require('../comunidad/comunidad.repository');
const { Programacion } = require('../programacion/programacion.schema');
const { Salon } = require('../salones/salon.schema');
const { Reserva } = require('../reservas/reserva.schema');
const monitorRepository = require('../monitores/monitor.repository');
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
function padHora(t) {
  if (!t) return t;
  const [h, ...rest] = String(t).split(':');
  return `${String(parseInt(h, 10) || 0).padStart(2, '0')}:${rest.join(':') || '00'}`;
}

/**
 * Regex que matchea un día ignorando tildes y mayúsculas.
 * "Miércoles" → /^[Mm][Ii][Ee][EeéÉ][Rr][Cc][Oo][Ll][Ee][Ss]$/i
 */
function diaRegex(dia) {
  const sinTildes = String(dia).normalize('NFD').replace(/[̀-ͯ]/g, '');
  const pattern = sinTildes.split('').map((ch) => {
    const map = { a: '[aáAÁ]', e: '[eéEÉ]', i: '[iíIÍ]', o: '[oóOÓ]', u: '[uúUÚ]' };
    return map[ch.toLowerCase()] || ch;
  }).join('');
  return new RegExp(`^${pattern}$`, 'i');
}

/** Normaliza nombre de aula: quita guiones para comparación (CO-105 === CO105). */
const normAula = (a) => String(a || '').replace(/-/g, '').trim();

function normalizarHorario(raw) {
  if (!raw) return { horario: '', hora_inicio: '', hora_fin: '' };
  const clean = String(raw).trim().replace(/\s*-{1,2}\s*/g, ' A ').replace(/\s+/g, ' ');
  const partes = clean.split(' A ');
  if (partes.length < 2) return { horario: clean, hora_inicio: padHora(partes[0]?.trim()) || '', hora_fin: '' };
  const hora_inicio = padHora(partes[0].trim());
  const hora_fin = padHora(partes[partes.length - 1].trim());
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
      // Normalizar nombre de aula: quitar guiones (ej: "M-303" → "M303", "CO-303" → "CO303")
      const aulaRaw = cleanText(row.aula ?? row.Aula ?? '').replace(/-/g, '');
      const diaRaw = cleanText(row.dia ?? row.Dia ?? row.Día ?? '');
      const horarioRaw = cleanText(row.horario ?? row.Horario ?? '');
      const responsableRaw = cleanText(row.responsable ?? row.Responsable ?? row.docente ?? row.Docente ?? '');
      const nroidentiRaw = cleanDocumento(
        row.nroidenti ?? row.NroIdenti ?? row.nroIdenti ?? row.numero_documento ?? row['Numero Documento'] ?? row.documento ?? row.Documento ?? ''
      ).trim();
      const nombre_reservaRaw = cleanText(row.nombre_reserva ?? row['Nombre Reserva'] ?? row.materia ?? row.Materia ?? '');
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
   */
  async validarConflictos({ nombre_salon, dia, hora_inicio, hora_fin, excluir_grupo_id, excluir_id, semestre }) {
    const conflictos = [];
    const toMin = (t) => { const [h, m] = String(t || '0:0').split(':').map(Number); return h * 60 + (m || 0); };

    const codigoSemestre = semestre || (await semestreRepository.findVigente())?.codigo;
    if (!codigoSemestre) throw ApiError.notFound('No hay semestre vigente');

    const aulaNorm = normAula(nombre_salon);
    const regexDia = diaRegex(dia);

    // Busca por aula normalizada (sin guiones) y dia con regex tolerante a tildes
    const [progRegular, semestralesExistentes] = await Promise.all([
      Programacion.find({
        tipo: 'programacion',
        aula: new RegExp(`^${aulaNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
        dia: regexDia,
        semestre: codigoSemestre,
        ...(excluir_id ? { _id: { $ne: excluir_id } } : {}),
      }).lean(),
      Programacion.find({
        tipo: 'semestral',
        aula: new RegExp(`^${aulaNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
        dia: regexDia,
        semestre: codigoSemestre,
        i_cancelada: { $ne: 1 },
        ...(excluir_grupo_id ? { grupo_id: { $ne: excluir_grupo_id } } : {}),
      }).lean(),
    ]);

    for (const p of progRegular) {
      if (p.hora_inicio && p.hora_fin && toMin(p.hora_inicio) < toMin(hora_fin) && toMin(p.hora_fin) > toMin(hora_inicio)) {
        conflictos.push({ tipo: 'programacion', detalle: `${p.docente || ''} — ${p.materia || ''} (${p.hora_inicio}–${p.hora_fin})` });
      }
    }

    const semestralesExistentesArr = semestralesExistentes;

    for (const s of semestralesExistentesArr) {
      if (s.hora_inicio && s.hora_fin && toMin(s.hora_inicio) < toMin(hora_fin) && toMin(s.hora_fin) > toMin(hora_inicio)) {
        conflictos.push({ tipo: 'semestral', detalle: `${s.docente || ''} — ${s.materia || ''} (${s.hora_inicio}–${s.hora_fin})` });
      }
    }

    return { tiene_conflictos: conflictos.length > 0, conflictos };
  }

  /**
   * Retorna los salones sin conflicto durante dia+hora en el semestre dado (o el vigente).
   */
  async salonesDisponibles(dia, hora_inicio, hora_fin, semestre, excluir_grupo_id = null, excluir_id = null) {
    let codigoSemestre;
    let filtroFechaIni;
    let filtroFechaFin;

    if (semestre) {
      const meta = await semestreRepository.findByCodigo(semestre);
      if (!meta) throw ApiError.notFound(`No existe el semestre "${semestre}"`);
      codigoSemestre = meta.codigo;
      filtroFechaIni = meta.fecha_inicio;
      filtroFechaFin = meta.fecha_fin;
    } else {
      const vigente = await semestreRepository.findVigente();
      if (!vigente) throw ApiError.notFound('No hay semestre vigente');
      codigoSemestre = vigente.codigo;
      filtroFechaIni = vigente.fecha_inicio;
      filtroFechaFin = vigente.fecha_fin;
    }

    const toMin = (t) => { const [h, m] = String(t || '0:0').split(':').map(Number); return h * 60 + (m || 0); };
    const horaInicioMin = toMin(hora_inicio);
    const horaFinMin = toMin(hora_fin);
    const solapan = (p) => p.hora_inicio && p.hora_fin && toMin(p.hora_inicio) < horaFinMin && toMin(p.hora_fin) > horaInicioMin;
    const regexDia = diaRegex(dia);

    const [progDia, semDia] = await Promise.all([
      Programacion.find({ tipo: 'programacion', dia: regexDia, semestre: codigoSemestre, ...(excluir_id ? { _id: { $ne: excluir_id } } : {}) }, { aula: 1, hora_inicio: 1, hora_fin: 1 }).lean(),
      Programacion.find({ tipo: 'semestral', dia: regexDia, semestre: codigoSemestre, i_cancelada: { $ne: 1 }, ...(excluir_grupo_id ? { grupo_id: { $ne: excluir_grupo_id } } : {}) }, { aula: 1, hora_inicio: 1, hora_fin: 1 }).lean(),
    ]);

    // Normalizar aulas (sin guiones) para comparar con Salon.nombre_salon
    const ocupadosProg = progDia.filter(solapan).map((p) => normAula(p.aula));
    const ocupadosSem = semDia.filter(solapan).map((p) => normAula(p.aula));

    const DIAS_JS = { lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6, domingo: 0 };
    const diaKey = dia.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const diaJS = DIAS_JS[diaKey] ?? DIAS_JS[dia.toLowerCase()];
    let ocupadosReservas = [];
    if (diaJS !== undefined) {
      const dowMongo = diaJS === 0 ? 1 : diaJS + 1;
      const reservasCandidatas = await Reserva.find(
        {
          estado: { $nin: ['cancelada', 'rechazada'] },
          fecha: { $gte: filtroFechaIni, $lte: filtroFechaFin },
          $expr: { $eq: [{ $dayOfWeek: '$fecha' }, dowMongo] },
        },
        { nombre_salon: 1, hora_inicio: 1, hora_fin: 1 }
      ).lean();
      ocupadosReservas = reservasCandidatas.filter(solapan).map((r) => r.nombre_salon);
    }

    const ocupados = new Set([...ocupadosProg, ...ocupadosSem, ...ocupadosReservas.map(normAula)]);
    const todos = await Salon.find().sort({ nombre_bloque: 1, nombre_salon: 1 }).lean();
    const disponibles = todos.filter((s) => !ocupados.has(normAula(s.nombre_salon)));
    return { salones: disponibles, semestre: codigoSemestre };
  }

  /**
   * Crea manualmente un conjunto de reservas semestrales (una por franja).
   */
  async crearManual(datos) {
    let codigoSemestre;
    let fechaInicioSemestre;
    let fechaFinSemestre;

    if (datos.semestre) {
      const meta = await semestreRepository.findByCodigo(datos.semestre);
      if (!meta) throw ApiError.notFound(`No existe el semestre "${datos.semestre}"`);
      codigoSemestre = meta.codigo;
      fechaInicioSemestre = meta.fecha_inicio;
      fechaFinSemestre = meta.fecha_fin;
    } else {
      const vigente = await semestreRepository.findVigente();
      if (!vigente) throw ApiError.notFound('No hay semestre vigente');
      codigoSemestre = vigente.codigo;
      fechaInicioSemestre = vigente.fecha_inicio;
      fechaFinSemestre = vigente.fecha_fin;
    }

    const persona = await comunidadRepository.findByDocumento(datos.solicitante_documento);
    const facultad = persona?.facultad || 'No aplica';

    const conflictosPorFranja = [];
    for (const franja of datos.franjas) {
      const salonFranja = franja.nombre_salon || datos.nombre_salon;
      const { tiene_conflictos, conflictos } = await this.validarConflictos({
        nombre_salon: salonFranja,
        dia: franja.dia,
        hora_inicio: franja.hora_inicio,
        hora_fin: franja.hora_fin,
        semestre: codigoSemestre,
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
      semestre: codigoSemestre,
      fecha_inicio_semestre: fechaInicioSemestre,
      fecha_fin_semestre: fechaFinSemestre,
      numero_documento: datos.solicitante_documento,
      docente: datos.solicitante_nombre,
      dia: franja.dia,
      hora_inicio: franja.hora_inicio,
      hora_fin: franja.hora_fin,
      horario: `${franja.hora_inicio} A ${franja.hora_fin}`,
      aula: franja.nombre_salon || datos.nombre_salon,
      nombre_bloque: franja.nombre_bloque || datos.nombre_bloque,
      materia: franja.motivo || datos.materia,
      facultad,
      i_cancelada: 0,
      grupo_id,
      creado_manualmente: true,
      tipo_solicitante: datos.tipo_solicitante,
      ...(datos.responsable_documento ? { responsable_documento: datos.responsable_documento } : {}),
      ...(datos.responsable_nombre ? { responsable_nombre: datos.responsable_nombre } : {}),
    }));

    await Programacion.insertMany(docs);
    logger.info('Reservas semestrales manuales creadas', { grupo_id, semestre: codigoSemestre, franjas: datos.franjas.length });

    const esEstudiante = datos.tipo_solicitante === 'estudiante';
    for (const franja of datos.franjas) {
      if (!franja.dia || !franja.hora_inicio || !franja.hora_fin) continue;
      const salonFranja = franja.nombre_salon || datos.nombre_salon;
      const materiaFranja = franja.motivo || datos.materia;
      const horarioFranja = `${franja.hora_inicio} A ${franja.hora_fin}`;

      if (franja.monitor_documento) {
        const docente_doc = esEstudiante ? datos.responsable_documento : datos.solicitante_documento;
        const docente_nombre = esEstudiante ? (datos.responsable_nombre || '') : datos.solicitante_nombre;
        try {
          const monitorPersona = await comunidadRepository.findByDocumento(franja.monitor_documento);
          await monitorRepository.create({
            numero_documento_docente: docente_doc,
            nombre_docente: docente_nombre,
            numero_documento_monitor: monitorPersona?.numero_documento || franja.monitor_documento,
            nombre_monitor: monitorPersona?.nombre || franja.monitor_nombre || '',
            id_carnet_monitor: monitorPersona?.id_carnet || '',
            facultad_monitor: monitorPersona?.facultad || '',
            correo_monitor: monitorPersona?.correo || '',
            materia: materiaFranja,
            aula: salonFranja,
            horario: horarioFranja,
            dia: franja.dia,
          });
          logger.info('Monitor registrado para franja semestral', { monitor: franja.monitor_documento, franja: franja.dia });
        } catch (e) {
          if (e.code !== 11000) logger.warn('No se pudo registrar monitor de franja', { err: e.message });
        }
      } else if (esEstudiante && datos.responsable_documento && datos.solicitante_documento) {
        try {
          await monitorRepository.create({
            numero_documento_docente: datos.responsable_documento,
            nombre_docente: datos.responsable_nombre || '',
            numero_documento_monitor: persona?.numero_documento || datos.solicitante_documento,
            nombre_monitor: persona?.nombre || datos.solicitante_nombre || '',
            id_carnet_monitor: persona?.id_carnet || '',
            facultad_monitor: persona?.facultad || '',
            correo_monitor: persona?.correo || '',
            materia: materiaFranja,
            aula: salonFranja,
            horario: horarioFranja,
            dia: franja.dia,
          });
          logger.info('Estudiante registrado como monitor automático', { estudiante: datos.solicitante_documento, docente: datos.responsable_documento });
        } catch (e) {
          if (e.code !== 11000) logger.warn('No se pudo registrar monitor automático', { err: e.message });
        }
      }
    }

    return { grupo_id, insertados: docs.length, semestre: codigoSemestre };
  }

  /**
   * Lista todas las reservas semestrales (todos los semestres), agrupadas por grupo_id cuando aplica.
   */
  async listarTodas() {
    const todas = await reservasSemestralesRepository.findAll();
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


  /**
   * Actualiza un grupo de reservas semestrales (reemplaza sus franjas).
   * Si la reserva no tiene grupo_id se le asigna uno nuevo.
   */
  async actualizarGrupo(id, datos) {
    const docExistente = await reservasSemestralesRepository.findById(id);
    if (!docExistente) throw ApiError.notFound('No se encontró la reserva');

    const grupoId = docExistente.grupo_id || String(docExistente._id);

    let codigoSemestre;
    let fechaInicioSemestre;
    let fechaFinSemestre;

    if (datos.semestre) {
      const meta = await semestreRepository.findByCodigo(datos.semestre);
      if (!meta) throw ApiError.notFound('No existe el semestre seleccionado');
      codigoSemestre = meta.codigo;
      fechaInicioSemestre = meta.fecha_inicio;
      fechaFinSemestre = meta.fecha_fin;
    } else {
      codigoSemestre = docExistente.semestre;
      const meta = await semestreRepository.findByCodigo(codigoSemestre);
      fechaInicioSemestre = meta && meta.fecha_inicio;
      fechaFinSemestre = meta && meta.fecha_fin;
    }

    const persona = await comunidadRepository.findByDocumento(datos.solicitante_documento);
    const facultad = (persona && persona.facultad) || 'No aplica';

    const conflictosPorFranja = [];
    for (const franja of datos.franjas) {
      const res = await this.validarConflictos({
        nombre_salon: franja.nombre_salon,
        dia: franja.dia,
        hora_inicio: franja.hora_inicio,
        hora_fin: franja.hora_fin,
        semestre: codigoSemestre,
        excluir_grupo_id: grupoId,
      });
      if (res.tiene_conflictos) conflictosPorFranja.push({ franja, conflictos: res.conflictos });
    }

    if (conflictosPorFranja.length > 0 && !datos.forzar) {
      throw ApiError.conflict('Existen conflictos en las franjas seleccionadas', { conflictosPorFranja });
    }

    if (docExistente.grupo_id) {
      await reservasSemestralesRepository.deleteByGrupoId(docExistente.grupo_id);
    } else {
      await reservasSemestralesRepository.deleteById(id);
    }

    const docs = datos.franjas.map((franja) => ({
      tipo: 'semestral',
      semestre: codigoSemestre,
      fecha_inicio_semestre: fechaInicioSemestre,
      fecha_fin_semestre: fechaFinSemestre,
      numero_documento: datos.solicitante_documento,
      docente: datos.solicitante_nombre,
      dia: franja.dia,
      hora_inicio: franja.hora_inicio,
      hora_fin: franja.hora_fin,
      horario: franja.hora_inicio + ' A ' + franja.hora_fin,
      aula: franja.nombre_salon,
      nombre_bloque: franja.nombre_bloque || '',
      materia: franja.motivo || datos.materia,
      facultad,
      i_cancelada: 0,
      grupo_id: grupoId,
      creado_manualmente: true,
      tipo_solicitante: datos.tipo_solicitante,
      ...(datos.responsable_documento ? { responsable_documento: datos.responsable_documento } : {}),
      ...(datos.responsable_nombre ? { responsable_nombre: datos.responsable_nombre } : {}),
    }));

    await Programacion.insertMany(docs);
    logger.info('Reservas semestrales actualizadas', { grupo_id: grupoId, semestre: codigoSemestre, franjas: datos.franjas.length });
    return { grupo_id: grupoId, insertados: docs.length, semestre: codigoSemestre };
  }

  /**
   * Elimina una franja de reserva semestral por su _id.
   * Solo elimina esa franja, aunque pertenezca a un grupo.
   * @param {string} id - MongoDB _id de la franja
   * @returns {Promise<{eliminados: number}>}
   */
  async eliminarIndividual(id) {
    const doc = await reservasSemestralesRepository.findById(id);
    if (!doc) throw ApiError.notFound('No se encontró la reserva');
    const result = await reservasSemestralesRepository.deleteById(id);
    logger.info('Franja de reserva semestral eliminada', { id, grupo_id: doc.grupo_id, eliminados: result.deletedCount });
    return { eliminados: result.deletedCount };
  }
}

module.exports = new ReservasSemestralesService();
