'use strict';
/**
 * Date Helper - Equivale a application/helpers/date_helper.py y time_helper.py
 */

const DIAS_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

/**
 * Formatea una cantidad de minutos en texto legible (min / h min / d h min)
 * @param {number} minutos
 * @returns {string} Ej: "45min", "2h 15min", "3d 8h 33min"
 */
function formatMinutos(minutos) {
  const total = Math.max(0, Math.round(minutos));
  const dias = Math.floor(total / 1440);
  const horas = Math.floor((total % 1440) / 60);
  const mins = total % 60;
  const partes = [];
  if (dias > 0) partes.push(`${dias}d`);
  if (horas > 0) partes.push(`${horas}h`);
  if (mins > 0 || partes.length === 0) partes.push(`${mins}min`);
  return partes.join(' ');
}

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
      return formatMinutos(retrasoMin);
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
    return formatMinutos(diffMin);
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
 * Verifica si el reclamo es anticipado (más de 30 minutos antes del inicio de la clase)
 * Dentro de 30 min antes se considera reclamo normal a tiempo
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
    return minutosAhora < horaInicio - 30;
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
    if (diffMin <= 0) return '0min';
    return formatMinutos(diffMin);
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
    return formatMinutos(diff);
  } catch {
    return '';
  }
}

module.exports = {
  getDiaActual,
  getFechaHoy,
  horaAMinutos,
  formatMinutos,
  calcularRetrasoDevolucion,
  calcularDuracion,
  calcularDuracionClase,
  calcularTiempoRetraso,
  esReclamoAnticipado,
  tieneGapMinimo,
  DIAS_ES,
};
