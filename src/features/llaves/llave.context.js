'use strict';

const llaveRepository = require('./llave.repository');
const comunidadRepository = require('../comunidad/comunidad.repository');
const programacionRepository = require('../programacion/programacion.repository');
const monitorRepository = require('../monitores/monitor.repository');
const reservasSemestralesRepository = require('../reservas_semestrales/reservas_semestrales.repository');
const {
  getFechaHoy,
  getDiaActual,
} = require('../../shared/utils/date.helper');
const {
  normalizeAula,
  normalizeHorario,
} = require('../../shared/utils/normalize.helper');
const {
  normalizarDocumento,
  matchMonitorClase,
  horarioCubiertoPorPrestamo,
  agruparClasesConsecutivas,
} = require('./llave.domain');

/**
 * Mapea una reserva semestral al formato de clase esperado por los workflows de llaves.
 * @param {object} reserva
 * @returns {object}
 */
function reservaSemestralToClase(reserva) {
  return {
    numero_documento: normalizarDocumento(reserva.nroidenti),
    dia: reserva.dia || '',
    horario: reserva.horario || '',
    hora_inicio: reserva.hora_inicio || '',
    hora_fin: reserva.hora_fin || '',
    aula: reserva.aula || '',
    facultad: 'Reserva Semestral',
    materia: reserva.nombre_reserva || '',
    _origen: 'reserva_semestral',
  };
}

/** Busca una persona de la comunidad por su ID de carnet NFC. */
async function buscarPersonaPorCarnet(idCarnet) {
  return comunidadRepository.findByCarnet(idCarnet);
}

/**
 * Resuelve el contexto completo para una lectura NFC: préstamo activo, rol y clases disponibles.
 * Prioriza devolución si hay préstamo pendiente, luego evalua si es docente o monitor.
 * @param {Object} persona - Persona encontrada por carnet
 * @param {string} documento - Documento normalizado
 * @returns {Promise<{ rol, docente, prestamoActivo, clasesDisponibles, mensajeSinClase? }>}
 */
async function resolverContextoNFC(persona, documento) {
  // Priorizar devolución: si el documento escaneado ya tiene llave en préstamo,
  // debe permitirse devolver incluso sin clases en programación.
  const prestamoActivo = await llaveRepository.findPendienteByDocumento(documento);
  if (prestamoActivo) {
    return { rol: 'docente', docente: persona, prestamoActivo, clasesDisponibles: [] };
  }

  const diaActual = getDiaActual();
  const [todasClases, registrosHoy, reservasSemestralesHoy] = await Promise.all([
    programacionRepository.findByDia(diaActual),
    llaveRepository.findByFecha(getFechaHoy()),
    reservasSemestralesRepository.findByDia(diaActual, new Date()),
  ]);

  const clasesDocente = (todasClases || []).filter(
    (clase) => normalizarDocumento(clase.numero_documento) === documento
  );

  const reservasDocente = (reservasSemestralesHoy || []).filter(
    (r) => normalizarDocumento(r.nroidenti) === documento
  );

  if (clasesDocente.length || reservasDocente.length) {
    return resolverContextoDocente({ persona, documento, clasesDocente, reservasDocente, registrosHoy });
  }

  return resolverContextoMonitor({ persona, documento, todasClases, registrosHoy });
}

/** Resuelve contexto cuando la persona es un docente con clases programadas o reservas semestrales. */
async function resolverContextoDocente({ persona, documento, clasesDocente, reservasDocente = [], registrosHoy }) {
  const prestamoActivo = await llaveRepository.findPendienteByDocumento(documento);
  if (prestamoActivo) {
    return { rol: 'docente', docente: persona, prestamoActivo, clasesDisponibles: [] };
  }

  const horariosProcesados = (registrosHoy || [])
    .filter((registro) => normalizarDocumento(registro.numero_documento) === documento)
    .map((registro) => String(registro.horario || '').trim());

  const clasesProgramacion = agruparClasesConsecutivas(
    (clasesDocente || []).filter(
      (clase) => !horarioCubiertoPorPrestamo(String(clase.horario || '').trim(), horariosProcesados)
    )
  );

  const clasesReservas = (reservasDocente || [])
    .map(reservaSemestralToClase)
    .filter((r) => !horarioCubiertoPorPrestamo(String(r.horario || '').trim(), horariosProcesados));

  const clasesDisponibles = [...clasesProgramacion, ...clasesReservas];

  if (!clasesDisponibles.length) {
    return {
      rol: 'docente',
      docente: persona,
      prestamoActivo: null,
      clasesDisponibles: [],
      mensajeSinClase: 'Todas las clases y reservas de hoy ya fueron procesadas',
    };
  }

  return { rol: 'docente', docente: persona, prestamoActivo: null, clasesDisponibles };
}

/** Resuelve contexto cuando la persona es un monitor autorizado. */
async function resolverContextoMonitor({ persona, documento, todasClases, registrosHoy }) {
  const asignaciones = await monitorRepository.findByDocumentoMonitor(documento);
  if (!asignaciones.length) {
    return {
      rol: 'docente',
      docente: persona,
      prestamoActivo: null,
      clasesDisponibles: [],
      mensajeSinClase: 'No tiene clases programadas hoy ni es monitor autorizado',
    };
  }

  for (const asignacion of asignaciones) {
    const docenteDocumento = normalizarDocumento(asignacion.numero_documento_docente);
    const prestamoActivo = await llaveRepository.findPendienteByDocumento(docenteDocumento);
    if (prestamoActivo) {
      const docente = await comunidadRepository.findByDocumento(docenteDocumento);
      return {
        rol: 'monitor',
        docente: docente || { numero_documento: docenteDocumento, nombre: asignacion.nombre_docente },
        prestamoActivo,
        clasesDisponibles: [],
      };
    }
  }

  const clasesDisponibles = await obtenerClasesDisponiblesMonitor({
    asignaciones,
    todasClases,
    registrosHoy,
  });

  if (!clasesDisponibles.length) {
    return {
      rol: 'monitor',
      docente: persona,
      prestamoActivo: null,
      clasesDisponibles: [],
      mensajeSinClase: 'No hay clases disponibles para este monitor hoy',
    };
  }

  const docenteTitular = await comunidadRepository.findByDocumento(
    normalizarDocumento(clasesDisponibles[0].numero_documento)
  );

  return {
    rol: 'monitor',
    docente: docenteTitular || persona,
    prestamoActivo: null,
    clasesDisponibles,
  };
}

/** Filtra clases disponibles para un monitor según sus asignaciones y registros ya procesados. */
async function obtenerClasesDisponiblesMonitor({ asignaciones = [], todasClases = [], registrosHoy = [] }) {
  const clasesMonitor = [];

  for (const asignacion of asignaciones) {
    const docenteDocumento = normalizarDocumento(asignacion.numero_documento_docente);
    const clasesDelDocente = (todasClases || []).filter(
      (clase) => normalizarDocumento(clase.numero_documento) === docenteDocumento
        && matchMonitorClase(asignacion, clase)
    );

    const horariosProcesados = (registrosHoy || [])
      .filter((registro) => normalizarDocumento(registro.numero_documento) === docenteDocumento)
      .map((registro) => String(registro.horario || '').trim());

    clasesMonitor.push(
      ...clasesDelDocente.filter(
        (clase) => !horarioCubiertoPorPrestamo(String(clase.horario || '').trim(), horariosProcesados)
      )
    );
  }

  return agruparClasesConsecutivas(clasesMonitor);
}

/** Busca una clase específica para confirmar un préstamo anticipado (docente o monitor). */
async function buscarClaseParaConfirmacion({ persona, aula, horario, rol }) {
  const documento = normalizarDocumento(persona.numero_documento);
  const aulaNormalizada = normalizeAula(aula);
  const horarioNormalizado = normalizeHorario(horario);
  const esMonitor = rol === 'monitor';
  const clases = await programacionRepository.findByDia(getDiaActual());

  let clase = null;
  let docenteDoc = documento;

  if (esMonitor) {
    const asignaciones = await monitorRepository.findByDocumentoMonitor(documento);
    for (const asignacion of asignaciones) {
      const docenteAsignado = normalizarDocumento(asignacion.numero_documento_docente);
      const clasesEnAula = (clases || []).filter(
        (item) => normalizarDocumento(item.numero_documento) === docenteAsignado
          && normalizeAula(item.aula) === aulaNormalizada
      );
      const agrupadas = agruparClasesConsecutivas(clasesEnAula);
      clase = agrupadas.find((item) => normalizeHorario(item.horario) === horarioNormalizado);
      if (clase) {
        docenteDoc = docenteAsignado;
        break;
      }
    }
  } else {
    const clasesEnAula = (clases || []).filter(
      (item) => normalizarDocumento(item.numero_documento) === documento
        && normalizeAula(item.aula) === aulaNormalizada
    );
    const agrupadas = agruparClasesConsecutivas(clasesEnAula);
    clase = agrupadas.find((item) => normalizeHorario(item.horario) === horarioNormalizado);

    // Buscar en reservas semestrales si no se encontró en programación
    if (!clase) {
      const reservasHoy = await reservasSemestralesRepository.findByDia(getDiaActual(), new Date());
      const reserva = (reservasHoy || []).find(
        (r) => normalizarDocumento(r.nroidenti) === docenteDoc
          && normalizeAula(r.aula) === aulaNormalizada
          && normalizeHorario(r.horario) === horarioNormalizado
      );
      if (reserva) clase = reservaSemestralToClase(reserva);
    }
  }

  return { clase, docenteDoc };
}

module.exports = {
  buscarPersonaPorCarnet,
  resolverContextoNFC,
  buscarClaseParaConfirmacion,
};
