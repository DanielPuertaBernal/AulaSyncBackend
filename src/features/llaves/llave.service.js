'use strict';
const llaveRepository = require('./llave.repository');
const { generateExcel } = require('../../shared/utils/excel.parser');
const {
  getFechaHoy,
  evaluarReclamoTiempo,
  calcularRetrasoDevolucion,
  calcularDuracion,
  horaAMinutos,
  getDiaActual,
} = require('../../shared/utils/date.helper');

class LlaveService {
  async obtenerPendientes() {
    const raw = await llaveRepository.findPendientes();
    return raw.map(this._toClientFormat);
  }

  async obtenerPendientesHoy() {
    const raw = await llaveRepository.findPendientesByFecha(getFechaHoy());
    return raw.map(this._toClientFormat);
  }

  async obtenerHistorial(filters = {}, pagination = null) {
    const result = await llaveRepository.findHistorial(filters, pagination);
    if (pagination) {
      return { data: result.data.map(this._toClientFormat), meta: result.meta };
    }
    return result.data.map(this._toClientFormat);
  }

  async obtenerClasesProcesadasHoy() {
    const registros = await llaveRepository.findByFecha(getFechaHoy());
    return registros.map((r) => ({
      documento: String(r.numero_documento).replace('.0', ''),
      horario: String(r.horario || '').trim(),
    }));
  }

  async registrarEntrega(infoClase) {
    const campos = ['nroidenti', 'profesor', 'aula'];
    for (const c of campos) {
      if (!infoClase[c]) {
        throw Object.assign(new Error(`Campo '${c}' requerido`), { statusCode: 400 });
      }
    }

    const documento = String(infoClase.nroidenti).replace('.0', '');

    const existing = await llaveRepository.findPendienteByDocumento(documento);
    if (existing) {
      throw Object.assign(new Error('El docente ya tiene una llave prestada'), { statusCode: 409 });
    }

    const ahora = new Date();
    const { seTiempo, retraso } = evaluarReclamoTiempo(infoClase.horario, ahora);

    const registro = {
      numero_documento: documento,
      docente: infoClase.profesor || '',
      dia: infoClase.dia || getDiaActual(),
      horario: infoClase.horario || '',
      aula: infoClase.aula,
      facultad: infoClase.facultad || 'No especificada',
      materia: infoClase.materia || '',
      fecha_entrega: ahora,
      fecha_devolucion: null,
      duracion: '',
      reclamo_a_tiempo: seTiempo,
      tiempo_retraso: retraso,
      retraso_entrega: 'No',
      tiempo_retraso_devolucion: '',
      estado: 'en_prestamo',
    };

    const created = await llaveRepository.create(registro);
    return { ok: true, mensaje: `Llave entregada a ${infoClase.profesor}`, registro: created };
  }

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
    const duracion = calcularDuracion(registro.fecha_entrega, ahora);
    const retrasoDevolucion = calcularRetrasoDevolucion(registro.horario, registro.fecha_entrega, ahora);

    const updates = {
      fecha_devolucion: ahora,
      duracion,
      tiempo_retraso_devolucion: retrasoDevolucion,
      retraso_entrega: retrasoDevolucion ? 'Sí' : 'No',
      estado: 'devuelta',
    };

    const updated = await llaveRepository.update(registro._id, updates);
    return { ok: true, mensaje: `Llave devuelta por ${registro.docente}`, registro: updated };
  }

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

  async exportarHistorial(filters = {}) {
    const registros = await llaveRepository.findHistorial(filters);
    return generateExcel(registros, 'Historial Llaves');
  }

  _toClientFormat(r) {
    const formatDate = (d) => (d instanceof Date ? d.toISOString().split('T')[0] : '');
    const formatTime = (d) => (d instanceof Date ? d.toTimeString().split(' ')[0] : '');

    return {
      documento: String(r.numero_documento).replace('.0', ''),
      docente: r.docente,
      dia: r.dia,
      horario: r.horario,
      aula: r.aula,
      facultad: r.facultad,
      materia: r.materia,
      fechaEntrega: formatDate(r.fecha_entrega),
      horaEntrega: formatTime(r.fecha_entrega),
      fechaDevolucion: formatDate(r.fecha_devolucion),
      horaDevolucion: formatTime(r.fecha_devolucion),
      duracion: r.duracion,
      seReclamoATiempo: r.reclamo_a_tiempo,
      tiempoRetraso: r.tiempo_retraso,
      retrasoEntrega: r.retraso_entrega,
      tiempoRetrasoDevolucion: r.tiempo_retraso_devolucion,
      estado: r.estado,
    };
  }
}

module.exports = new LlaveService();
