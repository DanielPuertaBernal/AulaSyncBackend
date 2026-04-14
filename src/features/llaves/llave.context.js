'use strict';

const llaveRepository = require('./llave.repository');
const comunidadRepository = require('../comunidad/comunidad.repository');
const programacionRepository = require('../programacion/programacion.repository');
const monitorRepository = require('../monitores/monitor.repository');
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

async function buscarPersonaPorCarnet(idCarnet) {
  return comunidadRepository.findByCarnet(idCarnet);
}

async function resolverContextoNFC(persona, documento) {
  // Priorizar devolución: si el documento escaneado ya tiene llave en préstamo,
  // debe permitirse devolver incluso sin clases en programación.
  const prestamoActivo = await llaveRepository.findPendienteByDocumento(documento);
  if (prestamoActivo) {
    return { rol: 'docente', docente: persona, prestamoActivo, clasesDisponibles: [] };
  }

  const diaActual = getDiaActual();
  const [todasClases, registrosHoy] = await Promise.all([
    programacionRepository.findByDia(diaActual),
    llaveRepository.findByFecha(getFechaHoy()),
  ]);

  const clasesDocente = (todasClases || []).filter(
    (clase) => normalizarDocumento(clase.numero_documento) === documento
  );

  if (clasesDocente.length) {
    return resolverContextoDocente({ persona, documento, clasesDocente, registrosHoy });
  }

  return resolverContextoMonitor({ persona, documento, todasClases, registrosHoy });
}

async function resolverContextoDocente({ persona, documento, clasesDocente, registrosHoy }) {
  const prestamoActivo = await llaveRepository.findPendienteByDocumento(documento);
  if (prestamoActivo) {
    return { rol: 'docente', docente: persona, prestamoActivo, clasesDisponibles: [] };
  }

  const horariosProcesados = (registrosHoy || [])
    .filter((registro) => normalizarDocumento(registro.numero_documento) === documento)
    .map((registro) => String(registro.horario || '').trim());

  const clasesDisponibles = agruparClasesConsecutivas(
    (clasesDocente || []).filter(
      (clase) => !horarioCubiertoPorPrestamo(String(clase.horario || '').trim(), horariosProcesados)
    )
  );

  if (!clasesDisponibles.length) {
    return {
      rol: 'docente',
      docente: persona,
      prestamoActivo: null,
      clasesDisponibles: [],
      mensajeSinClase: 'Todas las clases de hoy ya fueron procesadas',
    };
  }

  return { rol: 'docente', docente: persona, prestamoActivo: null, clasesDisponibles };
}

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
  }

  return { clase, docenteDoc };
}

module.exports = {
  buscarPersonaPorCarnet,
  resolverContextoNFC,
  buscarClaseParaConfirmacion,
};
