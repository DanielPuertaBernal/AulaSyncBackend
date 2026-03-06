'use strict';
/**
 * Date Helper - Equivale a application/helpers/date_helper.py y time_helper.py
 */

const DIAS_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

/**
 * Retorna el nombre del día actual en español
 * @returns {string} Ej: "Lunes"
 */
function getDiaActual() {
  return DIAS_ES[new Date().getDay()];
}

/**
 * Retorna la fecha actual en formato YYYY-MM-DD
 * @returns {string}
 */
function getFechaHoy() {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

/**
 * Retorna la hora actual en formato HH:MM:SS
 * @returns {string}
 */
function getHoraActual() {
  const now = new Date();
  return now.toTimeString().split(' ')[0];
}

/**
 * Parsea una hora en formato "HH:MM" o "HH:MM:SS" y retorna objeto {hours, minutes}
 * @param {string} horaStr
 * @returns {{hours: number, minutes: number} | null}
 */
function parseHora(horaStr) {
  if (!horaStr) return null;
  const parts = String(horaStr).trim().split(':');
  if (parts.length < 2) return null;
  return {
    hours: parseInt(parts[0], 10),
    minutes: parseInt(parts[1], 10),
  };
}

/**
 * Convierte hora "HH:MM" a minutos desde medianoche
 * @param {string} horaStr
 * @returns {number | null}
 */
function horaAMinutos(horaStr) {
  const parsed = parseHora(horaStr);
  if (!parsed) return null;
  return parsed.hours * 60 + parsed.minutes;
}

/**
 * Evalúa si la entrega de llave fue dentro de la hora de inicio de clase
 * "Se reclamó a tiempo" = entregaron la llave antes o máximo 10 minutos DESPUÉS del inicio
 * @param {string} horario  Ej: "07:00 A 09:00"
 * @param {Date} ahora
 * @returns {{ seTiempo: boolean, retraso: string }}
 */
function evaluarReclamoTiempo(horario, ahora = new Date()) {
  try {
    if (!horario) return { seTiempo: false, retraso: '' };

    const partes = String(horario).toUpperCase().split(' A ');
    if (partes.length < 1) return { seTiempo: false, retraso: '' };

    const horaInicio = horaAMinutos(partes[0].trim());
    if (horaInicio === null) return { seTiempo: false, retraso: '' };

    const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes();
    const diffMinutos = minutosAhora - horaInicio;

    // Si entregó antes o hasta 10 minutos después se considera "a tiempo"
    const seTiempo = diffMinutos <= 10;
    const retraso = diffMinutos > 0
      ? `${Math.floor(diffMinutos / 60)}h ${diffMinutos % 60}min`
      : '';

    return { seTiempo, retraso };
  } catch {
    return { seTiempo: false, retraso: '' };
  }
}

/**
 * Evalúa si hay retraso en DEVOLUCIÓN (> 1 hora después de fin de clase)
 * @param {string} horario  Ej: "07:00 A 09:00"
 * @param {string} fechaEntrega  Ej: "2024-01-15"
 * @param {Date} ahora
 * @returns {string} Descripción del retraso o string vacío
 */
function calcularRetrasoDevolucion(horario, fechaEntrega, ahora = new Date()) {
  try {
    if (!horario || !fechaEntrega) return '';
    const partes = String(horario).toUpperCase().split(' A ');
    if (partes.length < 2) return '';

    const horaFin = horaAMinutos(partes[1].trim());
    if (horaFin === null) return '';

    const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes();
    const umbralMinutos = horaFin + 60; // 1 hora de gracia

    if (minutosAhora > umbralMinutos) {
      const retrasoMin = minutosAhora - horaFin;
      return `${Math.floor(retrasoMin / 60)}h ${retrasoMin % 60}min`;
    }
    return '';
  } catch {
    return '';
  }
}

/**
 * Calcula la duración entre entrega y devolución
 * @param {Date} fechaEntrega
 * @param {Date} ahora
 * @returns {string}
 */
function calcularDuracion(fechaEntrega, ahora = new Date()) {
  try {
    if (!fechaEntrega) return '';
    const diffMs = ahora - fechaEntrega;
    const diffMin = Math.floor(diffMs / 60000);
    return `${Math.floor(diffMin / 60)}h ${diffMin % 60}min`;
  } catch {
    return '';
  }
}

/**
 * Verifica si hay gap mínimo de 30 min entre clases continuas del mismo docente
 * Equivale a ProgramacionCleaner.evaluar_clases_continuas
 * @param {Array<{horaFin: string}>} clasesDocente  Clases del docente ordenadas
 * @param {string} nuevaHoraInicio
 * @returns {boolean} true si hay gap suficiente o no hay clases previas
 */
function tieneGapMinimo(clasesDocente, nuevaHoraInicio, gapMinutos = 30) {
  if (!clasesDocente.length) return true;
  const ultimaClase = clasesDocente[clasesDocente.length - 1];
  const finUltima = horaAMinutos(ultimaClase.horaFin);
  const inicioNueva = horaAMinutos(nuevaHoraInicio);
  if (finUltima === null || inicioNueva === null) return true;
  return (inicioNueva - finUltima) >= gapMinutos;
}

/**
 * Verifica si el reclamo es anticipado (más de 1 hora antes del inicio de la clase)
 * Dentro de 1h antes se considera reclamo normal a tiempo
 * @param {string} horario  Ej: "07:00 A 09:00"
 * @param {Date} ahora
 * @returns {boolean}
 */
function esReclamoAnticipado(horario, ahora = new Date()) {
  try {
    if (!horario) return false;
    const partes = String(horario).toUpperCase().split(' A ');
    if (partes.length < 1) return false;
    const horaInicio = horaAMinutos(partes[0].trim());
    if (horaInicio === null) return false;
    const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes();
    return minutosAhora < horaInicio - 60;
  } catch {
    return false;
  }
}

/**
 * Calcula duración desde el inicio de la clase hasta la devolución
 * @param {string} horario  Ej: "07:00 A 09:00"
 * @param {Date} fechaDevolucion
 * @returns {string}
 */
function calcularDuracionClase(horario, fechaDevolucion = new Date()) {
  try {
    if (!horario) return '';
    const partes = String(horario).toUpperCase().split(' A ');
    if (partes.length < 1) return '';
    const horaInicio = horaAMinutos(partes[0].trim());
    if (horaInicio === null) return '';
    const minutosDevolucion = fechaDevolucion.getHours() * 60 + fechaDevolucion.getMinutes();
    const diffMin = minutosDevolucion - horaInicio;
    if (diffMin <= 0) return '0h 0min';
    return `${Math.floor(diffMin / 60)}h ${diffMin % 60}min`;
  } catch {
    return '';
  }
}

/**
 * Calcula tiempo de retraso al reclamar llave después del inicio de clase
 * @param {string} horario  Ej: "07:00 A 09:00"
 * @param {Date} ahora
 * @returns {string}
 */
function calcularTiempoRetraso(horario, ahora = new Date()) {
  try {
    if (!horario) return '';
    const partes = String(horario).toUpperCase().split(' A ');
    if (partes.length < 1) return '';
    const horaInicio = horaAMinutos(partes[0].trim());
    if (horaInicio === null) return '';
    const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes();
    const diff = minutosAhora - horaInicio;
    if (diff <= 0) return '';
    return `${Math.floor(diff / 60)}h ${diff % 60}min`;
  } catch {
    return '';
  }
}

module.exports = {
  getDiaActual,
  getFechaHoy,
  getHoraActual,
  parseHora,
  horaAMinutos,
  evaluarReclamoTiempo,
  calcularRetrasoDevolucion,
  calcularDuracion,
  calcularDuracionClase,
  calcularTiempoRetraso,
  esReclamoAnticipado,
  tieneGapMinimo,
  DIAS_ES,
};
