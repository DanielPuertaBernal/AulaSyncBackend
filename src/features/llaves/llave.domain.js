'use strict';

const { horaAMinutos } = require('../../shared/utils/date.helper');

function normalizarDocumento(value = '') {
  return String(value || '').replace('.0', '').trim();
}

function matchMonitorClase(asignacion, clase) {
  const materiaMatch = String(asignacion?.materia || '').trim().toLowerCase() ===
    String(clase?.materia || '').trim().toLowerCase();
  if (!materiaMatch) return false;

  if (asignacion?.dia && asignacion?.horario) {
    return String(asignacion.horario || '').trim() === String(clase?.horario || '').trim();
  }

  return true;
}

function horarioCubiertoPorPrestamo(horarioClase, horariosProcesados) {
  const partes = String(horarioClase || '').toUpperCase().split(' A ');
  const claseInicio = horaAMinutos(partes[0]?.trim());
  const claseFin = horaAMinutos(partes[1]?.trim());
  if (claseInicio === null || claseFin === null) return false;

  return (horariosProcesados || []).some((horarioProcesado) => {
    const procesado = String(horarioProcesado || '').toUpperCase().split(' A ');
    const inicioProcesado = horaAMinutos(procesado[0]?.trim());
    const finProcesado = horaAMinutos(procesado[1]?.trim());
    if (inicioProcesado === null || finProcesado === null) return false;
    return claseInicio >= inicioProcesado && claseFin <= finProcesado;
  });
}

function agruparClasesConsecutivas(clases = []) {
  const grupos = new Map();

  for (const clase of clases) {
    const documento = normalizarDocumento(clase?.numero_documento);
    const aula = String(clase?.aula || '').trim().toUpperCase();
    const key = `${documento}||${aula}`;
    if (!grupos.has(key)) grupos.set(key, []);
    grupos.get(key).push(clase);
  }

  const resultado = [];

  for (const bloques of grupos.values()) {
    if (bloques.length === 1) {
      resultado.push(bloques[0]);
      continue;
    }

    bloques.sort((a, b) => {
      const inicioA = String(a?.horario || '').toUpperCase().split(' A ')[0]?.trim();
      const inicioB = String(b?.horario || '').toUpperCase().split(' A ')[0]?.trim();
      return (horaAMinutos(inicioA) ?? 0) - (horaAMinutos(inicioB) ?? 0);
    });

    let actual = { ...bloques[0] };
    let materias = [actual.materia || ''];

    for (let i = 1; i < bloques.length; i += 1) {
      const siguiente = bloques[i];
      const finActualStr = String(actual?.horario || '').toUpperCase().split(' A ')[1]?.trim();
      const inicioSiguienteStr = String(siguiente?.horario || '').toUpperCase().split(' A ')[0]?.trim();
      const finActual = horaAMinutos(finActualStr);
      const inicioSiguiente = horaAMinutos(inicioSiguienteStr);

      if (finActual !== null && inicioSiguiente !== null && finActual === inicioSiguiente) {
        const horaInicio = String(actual?.horario || '').toUpperCase().split(' A ')[0]?.trim();
        const horaFin = String(siguiente?.horario || '').toUpperCase().split(' A ')[1]?.trim();
        actual.horario = `${horaInicio} A ${horaFin}`;
        actual.hora_fin = horaFin;
        materias.push(siguiente.materia || '');
      } else {
        actual.materia = [...new Set(materias.filter(Boolean))].join(', ');
        resultado.push(actual);
        actual = { ...siguiente };
        materias = [siguiente.materia || ''];
      }
    }

    actual.materia = [...new Set(materias.filter(Boolean))].join(', ');
    resultado.push(actual);
  }

  return resultado;
}

function encontrarClaseActual(clases = [], minutosAhora) {
  let mejorClase = null;
  let menorDiff = Number.POSITIVE_INFINITY;

  for (const clase of clases) {
    const horario = String(clase?.horario || '').toUpperCase();
    const partes = horario.split(' A ');
    if (partes.length < 2) continue;

    const inicio = horaAMinutos(partes[0]?.trim());
    const fin = horaAMinutos(partes[1]?.trim());
    if (inicio === null || fin === null) continue;

    if (minutosAhora <= fin) {
      const diff = Math.abs(minutosAhora - inicio);
      if (diff < menorDiff) {
        menorDiff = diff;
        mejorClase = clase;
      }
    }
  }

  return mejorClase;
}

function calcularEstadoVisual(registro, limiteHorasDemora = 4) {
  if (registro?.fecha_hora_devolucion) {
    return 'entregado';
  }

  const estadoActual = registro?.estado || '';
  if (estadoActual !== 'en_prestamo') return estadoActual;

  const fechaEntrega = registro?.fecha_hora_entrega instanceof Date
    ? registro.fecha_hora_entrega
    : (registro?.fecha_hora_entrega ? new Date(registro.fecha_hora_entrega) : null);
  if (!fechaEntrega || Number.isNaN(fechaEntrega.getTime())) return estadoActual;

  const horario = String(registro?.horario || '').toUpperCase().split(' A ');
  if (horario.length < 2) return estadoActual;

  const finMinutos = horaAMinutos(String(horario[1] || '').trim());
  if (finMinutos === null) return estadoActual;

  const finClase = new Date(fechaEntrega);
  finClase.setHours(Math.floor(finMinutos / 60), finMinutos % 60, 0, 0);

  const umbralDemora = new Date(finClase.getTime() + (limiteHorasDemora * 60 * 60 * 1000));
  return new Date() > umbralDemora ? 'demora_entrega' : estadoActual;
}

function toClientFormat(registro, limiteHorasDemora = 4) {
  const formatDate = (value) => (value instanceof Date ? value.toISOString().split('T')[0] : '');
  const formatTime = (value) => (value instanceof Date ? value.toTimeString().split(' ')[0] : '');

  return {
    _id: registro?._id,
    documento: normalizarDocumento(registro?.numero_documento),
    docente: registro?.docente,
    dia: registro?.dia,
    horario: registro?.horario,
    aula: registro?.aula,
    facultad: registro?.facultad,
    materia: registro?.materia,
    fechaEntrega: formatDate(registro?.fecha_hora_entrega),
    horaEntrega: formatTime(registro?.fecha_hora_entrega),
    fechaDevolucion: formatDate(registro?.fecha_hora_devolucion),
    horaDevolucion: formatTime(registro?.fecha_hora_devolucion),
    duracion: registro?.duracion,
    seReclamoATiempo: registro?.se_reclamo_a_tiempo,
    tiempoRetraso: registro?.tiempo_retraso,
    retrasoEntrega: registro?.retraso_entrega,
    tiempoRetrasoDevolucion: registro?.tiempo_retraso_devolucion,
    ubicacionPrestamo: registro?.ubicacion_prestamo || '',
    ubicacionDevolucion: registro?.ubicacion_devolucion || '',
    quienReclama: registro?.quien_reclama || '',
    documentoReclama: registro?.numero_documento_reclama || '',
    nombreReclama: registro?.nombre_reclama || '',
    quienEntrega: registro?.quien_entrega || '',
    documentoEntrega: registro?.numero_documento_entrega || '',
    nombreEntrega: registro?.nombre_entrega || '',
    tipoEntrega: registro?.tipo_entrega || '',
    origenRegistro: registro?.origen_registro || '',
    estado: calcularEstadoVisual(registro, limiteHorasDemora),
  };
}

module.exports = {
  normalizarDocumento,
  matchMonitorClase,
  horarioCubiertoPorPrestamo,
  agruparClasesConsecutivas,
  encontrarClaseActual,
  calcularEstadoVisual,
  toClientFormat,
};
