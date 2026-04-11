'use strict';

const {
  horaAMinutos,
  getDiaActual,
  getFechaHoy,
  calcularRetrasoDevolucion,
  calcularDuracion,
  calcularTiempoRetraso,
} = require('../../shared/utils/date.helper');
const {
  normalizeString,
  normalizeDocumento,
  normalizeHorario,
  normalizeAula,
} = require('../../shared/utils/normalize.helper');

const normalizarDocumento = normalizeDocumento;

function matchMonitorClase(asignacion, clase) {
  const materiaMatch = normalizeString(asignacion?.materia).toLowerCase() ===
    normalizeString(clase?.materia).toLowerCase();
  if (!materiaMatch) return false;

  if (asignacion?.dia && asignacion?.horario) {
    return normalizeString(asignacion.horario) === normalizeString(clase?.horario);
  }

  return true;
}

function horarioCubiertoPorPrestamo(horarioClase, horariosProcesados) {
  const partes = normalizeHorario(horarioClase).split(' A ');
  const claseInicio = horaAMinutos(partes[0]?.trim());
  const claseFin = horaAMinutos(partes[1]?.trim());
  if (claseInicio === null || claseFin === null) return false;

  return (horariosProcesados || []).some((horarioProcesado) => {
    const procesado = normalizeHorario(horarioProcesado).split(' A ');
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
    const aula = normalizeAula(clase?.aula);
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
      const inicioA = normalizeHorario(a?.horario).split(' A ')[0]?.trim();
      const inicioB = normalizeHorario(b?.horario).split(' A ')[0]?.trim();
      return (horaAMinutos(inicioA) ?? 0) - (horaAMinutos(inicioB) ?? 0);
    });

    let actual = { ...bloques[0] };
    let materias = [actual.materia || ''];

    for (let i = 1; i < bloques.length; i += 1) {
      const siguiente = bloques[i];
      const finActualStr = normalizeHorario(actual?.horario).split(' A ')[1]?.trim();
      const inicioSiguienteStr = normalizeHorario(siguiente?.horario).split(' A ')[0]?.trim();
      const finActual = horaAMinutos(finActualStr);
      const inicioSiguiente = horaAMinutos(inicioSiguienteStr);

      if (finActual !== null && inicioSiguiente !== null && finActual === inicioSiguiente) {
        const horaInicio = normalizeHorario(actual?.horario).split(' A ')[0]?.trim();
        const horaFin = normalizeHorario(siguiente?.horario).split(' A ')[1]?.trim();
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
    const horario = normalizeHorario(clase?.horario);
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

function construirClasesProcesadas(registros = []) {
  return registros.map((registro) => ({
    documento: normalizarDocumento(registro?.numero_documento),
    horario: normalizeString(registro?.horario),
  }));
}

function construirResultadoError({ contexto = {}, persona = null, mensaje = '' }) {
  return {
    tipo: 'error',
    mensaje,
    docente: contexto.docente,
    persona,
    rol: contexto.rol,
  };
}

function construirResultadoSinClase({ contexto = {}, persona = null, mensaje = 'No hay clases disponibles' }) {
  return {
    tipo: 'sin_clase',
    mensaje,
    docente: contexto.docente,
    persona,
    rol: contexto.rol,
  };
}

function construirResultadoAnticipado({ contexto = {}, persona = null, clase = null }) {
  return {
    tipo: 'anticipado',
    docente: contexto.docente,
    persona,
    rol: contexto.rol,
    clase,
    se_reclamo_a_tiempo: true,
    mensaje: `${contexto.rol === 'monitor' ? 'El monitor' : 'El docente'} está reclamando la llave con anticipación`,
  };
}

function construirResultadoPrestamo({
  contexto = {},
  persona = null,
  clase = null,
  registro = null,
  ubicacion = '',
  seReclamoATiempo = true,
  tiempoRetraso = '',
}) {
  return {
    tipo: 'prestamo',
    docente: contexto.docente,
    persona,
    rol: contexto.rol,
    clase,
    registro,
    ubicacion,
    se_reclamo_a_tiempo: seReclamoATiempo,
    tiempo_retraso: tiempoRetraso,
  };
}

function construirResultadoDevolucion({
  contexto = {},
  persona = null,
  result = {},
  ubicacion = '',
}) {
  return {
    tipo: 'devolucion',
    ...result,
    docente: contexto.docente,
    persona,
    rol: contexto.rol,
    ubicacion,
  };
}

function construirRegistroPrestamo({
  docente,
  clase,
  seReclamoATiempo,
  tiempoRetraso,
  reclamaInfo = {},
  tipoEntrega = 'carnet',
  ubicacionPrestamo,
}) {
  return {
    numero_documento: normalizarDocumento(docente?.numero_documento),
    docente: docente?.nombre || '',
    dia: clase?.dia || getDiaActual(),
    horario: clase?.horario || '',
    aula: clase?.aula || '',
    facultad: clase?.facultad || 'No especificada',
    materia: clase?.materia || '',
    fecha_hora_entrega: new Date(),
    fecha_hora_devolucion: null,
    duracion: '',
    se_reclamo_a_tiempo: seReclamoATiempo,
    tiempo_retraso: tiempoRetraso || '',
    retraso_entrega: false,
    tiempo_retraso_devolucion: '',
    tipo_entrega: tipoEntrega,
    origen_registro: 'programacion',
    ubicacion_prestamo: ubicacionPrestamo,
    ubicacion_devolucion: '',
    quien_reclama: reclamaInfo.quien || 'docente',
    numero_documento_reclama: reclamaInfo.documento || normalizarDocumento(docente?.numero_documento),
    nombre_reclama: reclamaInfo.nombre || docente?.nombre || '',
    quien_entrega: '',
    numero_documento_entrega: '',
    nombre_entrega: '',
    estado: 'en_prestamo',
  };
}

function construirRegistroEntregaManual({
  infoClase,
  documento,
  ubicacionPrestamo,
  origenRegistro,
}) {
  const ahora = new Date();
  const horario = (infoClase?.hora_inicio && infoClase?.hora_fin)
    ? `${infoClase.hora_inicio} A ${infoClase.hora_fin}`
    : '';
  const tiempoRetraso = horario ? calcularTiempoRetraso(horario, ahora) : '';
  const seReclamoATiempo = horario ? !tiempoRetraso : true;

  return {
    numero_documento: documento,
    docente: infoClase?.profesor || '',
    dia: getDiaActual(),
    horario,
    aula: infoClase?.aula || '',
    facultad: infoClase?.facultad || 'No especificada',
    materia: infoClase?.motivo || '',
    fecha_hora_entrega: ahora,
    fecha_hora_devolucion: null,
    duracion: '',
    se_reclamo_a_tiempo: seReclamoATiempo,
    tiempo_retraso: tiempoRetraso,
    retraso_entrega: !seReclamoATiempo,
    tiempo_retraso_devolucion: '',
    tipo_entrega: 'manual',
    origen_registro: origenRegistro,
    ubicacion_prestamo: ubicacionPrestamo,
    ubicacion_devolucion: '',
    quien_reclama: 'docente',
    numero_documento_reclama: documento,
    nombre_reclama: infoClase?.profesor || '',
    quien_entrega: '',
    numero_documento_entrega: '',
    nombre_entrega: '',
    estado: 'en_prestamo',
  };
}

function construirDatosDevolucion({
  registro,
  entregaInfo = {},
  ubicacionPorDefecto = '',
}) {
  const ahora = new Date();
  const fechaEntrega = registro?.fecha_hora_entrega instanceof Date
    ? registro.fecha_hora_entrega
    : (registro?.fecha_hora_entrega ? new Date(registro.fecha_hora_entrega) : null);
  const fechaStr = fechaEntrega && !Number.isNaN(fechaEntrega.getTime())
    ? fechaEntrega.toISOString().split('T')[0]
    : getFechaHoy();

  return {
    mensaje: `Llave devuelta por ${entregaInfo.nombre || registro?.docente}`,
    updates: {
      fecha_hora_devolucion: ahora,
      duracion: calcularDuracion(registro?.fecha_hora_entrega, ahora),
      tiempo_retraso_devolucion: calcularRetrasoDevolucion(registro?.horario, fechaStr, ahora),
      retraso_entrega: !!calcularRetrasoDevolucion(registro?.horario, fechaStr, ahora),
      estado: 'entregado',
      ubicacion_devolucion: entregaInfo.ubicacion || ubicacionPorDefecto,
      quien_entrega: entregaInfo.quien || 'docente',
      numero_documento_entrega: entregaInfo.documento || registro?.numero_documento,
      nombre_entrega: entregaInfo.nombre || registro?.docente,
    },
  };
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

  const horario = normalizeHorario(registro?.horario).split(' A ');
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
  construirClasesProcesadas,
  construirResultadoError,
  construirResultadoSinClase,
  construirResultadoAnticipado,
  construirResultadoPrestamo,
  construirResultadoDevolucion,
  construirRegistroPrestamo,
  construirRegistroEntregaManual,
  construirDatosDevolucion,
  calcularEstadoVisual,
  toClientFormat,
};
