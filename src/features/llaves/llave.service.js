'use strict';
/**
 * Llave Service
 * Equivale a: application/services/llave_service.py
 *           + infrastructure/repositories/llave_mongo_repository.py (lógica de negocio)
 */
const llaveRepository = require('./llave.repository');
const { generateExcel } = require('../../shared/utils/excel.parser');
const {
  getFechaHoy,
  getHoraActual,
  evaluarReclamoTiempo,
  calcularRetrasoDevolucion,
  calcularDuracion,
  horaAMinutos,
  getDiaActual,
} = require('../../shared/utils/date.helper');

class LlaveService {
  /**
   * Retorna todas las llaves actualmente en préstamo
   */
  async obtenerPendientes() {
    const raw = await llaveRepository.findPendientes();
    return raw.map(this._toClientFormat);
  }

  /**
   * Retorna llaves en préstamo del día actual
   */
  async obtenerPendientesHoy() {
    const raw = await llaveRepository.findPendientesByFecha(getFechaHoy());
    return raw.map(this._toClientFormat);
  }

  /**
   * Retorna historial con filtros opcionales
   */
  async obtenerHistorial(filters = {}) {
    const raw = await llaveRepository.findHistorial(filters);
    return raw.map(this._toClientFormat);
  }

  /**
   * Retorna clases procesadas hoy (doc + horario) para filtrar programación
   */
  async obtenerClasesProcesadasHoy() {
    const registros = await llaveRepository.findByFecha(getFechaHoy());
    return registros.map((r) => ({
      documento: String(r['Número de Documento']).replace('.0', ''),
      horario: String(r['Horario'] || '').trim(),
    }));
  }

  /**
   * Registra entrega de una llave
   * Equivale a LlaveMongoRepository.registrar_entrega
   * @param {object} infoClase
   */
  async registrarEntrega(infoClase) {
    const campos = ['nroidenti', 'profesor', 'aula'];
    for (const c of campos) {
      if (!infoClase[c]) {
        throw Object.assign(new Error(`Campo '${c}' requerido`), { statusCode: 400 });
      }
    }

    const documento = String(infoClase.nroidenti).replace('.0', '');

    // Verificar si ya tiene llave
    const existing = await llaveRepository.findPendienteByDocumento(documento);
    if (existing) {
      throw Object.assign(new Error('El docente ya tiene una llave prestada'), { statusCode: 409 });
    }

    const ahora = new Date();
    const { seTiempo, retraso } = evaluarReclamoTiempo(infoClase.horario, ahora);

    const registro = {
      'Número de Documento': documento,
      'Docente': infoClase.profesor || '',
      'Día': infoClase.dia || getDiaActual(),
      'Horario': infoClase.horario || '',
      'Aula': infoClase.aula,
      'Facultad': infoClase.facultad || 'No especificada',
      'Materia de la Clase': infoClase.materia || '',
      'Fecha de entrega': getFechaHoy(),
      'Hora de entrega': getHoraActual(),
      'Fecha de devolución': '',
      'Hora de devolución': '',
      'Duración clase (entrega→devolución)': '',
      'Se reclamó a tiempo': seTiempo,
      'Tiempo de retraso': retraso,
      'Retraso en entrega': 'No',
      'Tiempo retraso devolución': '',
      'Estado': 'En Préstamo',
    };

    const created = await llaveRepository.create(registro);
    return { ok: true, mensaje: `Llave entregada a ${infoClase.profesor}`, registro: created };
  }

  /**
   * Registra devolución de una llave
   * Equivale a LlaveMongoRepository.registrar_devolucion
   * @param {string} documento
   */
  async registrarDevolucion(documento) {
    const doc = String(documento).replace('.0', '');
    const registro = await llaveRepository.findPendienteByDocumento(doc);

    if (!registro) {
      throw Object.assign(
        new Error('No se encontró llave en préstamo para este docente'),
        { statusCode: 404 }
      );
    }

    const ahora = new Date();
    const duracion = calcularDuracion(registro['Fecha de entrega'], registro['Hora de entrega'], ahora);
    const retrasoDevolucion = calcularRetrasoDevolucion(registro['Horario'], registro['Fecha de entrega'], ahora);

    const updates = {
      'Fecha de devolución': getFechaHoy(),
      'Hora de devolución': getHoraActual(),
      'Duración clase (entrega→devolución)': duracion,
      'Tiempo retraso devolución': retrasoDevolucion,
      'Retraso en entrega': retrasoDevolucion ? 'Sí' : 'No',
      'Estado': 'Devuelta',
    };

    const updated = await llaveRepository.update(registro._id, updates);
    return { ok: true, mensaje: `Llave devuelta por ${registro['Docente']}`, registro: updated };
  }

  /**
   * Evalúa si hay retraso en entrega (> 1 hora después de fin de clase)
   * @param {string} horario  Ej: "07:00 A 09:00"
   */
  evalularRetrasoEntrega(horario) {
    if (!horario) return false;
    const partes = String(horario).toUpperCase().split(' A ');
    if (partes.length < 2) return false;
    const horaFin = horaAMinutos(partes[1].trim());
    if (horaFin === null) return false;
    const ahora = new Date();
    const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes();
    return minutosAhora > horaFin + 60;
  }

  /**
   * Exporta historial como buffer XLSX
   */
  async exportarHistorial(filters = {}) {
    const registros = await llaveRepository.findHistorial(filters);
    return generateExcel(registros, 'Historial Llaves');
  }

  /** Mapea documento de BD al formato cliente */
  _toClientFormat(r) {
    return {
      documento: String(r['Número de Documento']).replace('.0', ''),
      docente: r['Docente'],
      dia: r['Día'],
      horario: r['Horario'],
      aula: r['Aula'],
      facultad: r['Facultad'],
      materia: r['Materia de la Clase'],
      fechaEntrega: r['Fecha de entrega'],
      horaEntrega: r['Hora de entrega'],
      fechaDevolucion: r['Fecha de devolución'],
      horaDevolucion: r['Hora de devolución'],
      duracion: r['Duración clase (entrega→devolución)'],
      seReclamoATiempo: r['Se reclamó a tiempo'],
      tiempoRetraso: r['Tiempo de retraso'],
      retrasoEntrega: r['Retraso en entrega'],
      tiempoRetrasoDevolucion: r['Tiempo retraso devolución'],
      estado: r['Estado'],
    };
  }
}

module.exports = new LlaveService();
