'use strict';
const llaveRepository = require('./llave.repository');
const docenteRepository = require('../docentes/docente.repository');
const programacionRepository = require('../programacion/programacion.repository');
const { generateExcel } = require('../../shared/utils/excel.parser');
const {
  getFechaHoy,
  getDiaActual,
  horaAMinutos,
  calcularRetrasoDevolucion,
  calcularDuracion,
  calcularDuracionClase,
  calcularTiempoRetraso,
  esReclamoAnticipado,
} = require('../../shared/utils/date.helper');

const LIMITE_HORAS_DEMORA = 5;

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

  /**
   * Procesa una lectura NFC: determina si es préstamo o devolución
   */
  async procesarLecturaNFC(idCarnet) {
    const docente = await docenteRepository.findByCarnet(idCarnet);
    if (!docente) {
      return { tipo: 'error', mensaje: 'Docente no encontrado para este carnet' };
    }

    const documento = String(docente.numero_documento).replace('.0', '');

    // Si ya tiene llave prestada → devolución automática
    const prestamoActivo = await llaveRepository.findPendienteByDocumento(documento);
    if (prestamoActivo) {
      const result = await this._ejecutarDevolucion(prestamoActivo);
      return { tipo: 'devolucion', ...result, docente };
    }

    // Buscar clases programadas hoy
    const diaActual = getDiaActual();
    const clases = await programacionRepository.findByDia(diaActual);
    const clasesDocente = clases.filter(
      (c) => String(c.numero_documento).replace('.0', '') === documento
    );

    if (!clasesDocente.length) {
      return { tipo: 'sin_clase', mensaje: 'El docente no tiene clases programadas para hoy', docente };
    }

    // Filtrar clases ya procesadas
    const registrosHoy = await llaveRepository.findByFecha(getFechaHoy());
    const horariosProcessados = registrosHoy
      .filter((r) => String(r.numero_documento).replace('.0', '') === documento)
      .map((r) => String(r.horario || '').trim());

    const clasesDisponibles = clasesDocente.filter(
      (c) => !horariosProcessados.includes(String(c.horario || '').trim())
    );

    if (!clasesDisponibles.length) {
      return { tipo: 'sin_clase', mensaje: 'Todas las clases de hoy ya fueron procesadas', docente };
    }

    // Encontrar clase actual o próxima (dentro de 1h)
    const ahora = new Date();
    const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes();
    const claseTarget = this._encontrarClaseActual(clasesDisponibles, minutosAhora);

    if (!claseTarget) {
      return { tipo: 'sin_clase', mensaje: 'No hay clases en el horario actual o próximo', docente };
    }

    // Determinar si es anticipado o normal
    const anticipado = esReclamoAnticipado(claseTarget.horario, ahora);
    const tiempoRetraso = calcularTiempoRetraso(claseTarget.horario, ahora);
    const seReclamoATiempo = !tiempoRetraso;

    if (anticipado) {
      return {
        tipo: 'anticipado',
        docente,
        clase: claseTarget,
        se_reclamo_a_tiempo: true,
        mensaje: 'El docente está reclamando la llave con anticipación',
      };
    }

    // Registrar préstamo automáticamente
    const registro = await this._ejecutarPrestamo(docente, claseTarget, seReclamoATiempo, tiempoRetraso);
    return {
      tipo: 'prestamo',
      docente,
      clase: claseTarget,
      registro,
      se_reclamo_a_tiempo: seReclamoATiempo,
      tiempo_retraso: tiempoRetraso,
    };
  }

  /**
   * Confirma un préstamo anticipado tras aprobación del usuario
   */
  async confirmarPrestamoAnticipado({ id_carnet, horario, aula }) {
    const docente = await docenteRepository.findByCarnet(id_carnet);
    if (!docente) throw Object.assign(new Error('Docente no encontrado'), { statusCode: 404 });

    const documento = String(docente.numero_documento).replace('.0', '');
    const existing = await llaveRepository.findPendienteByDocumento(documento);
    if (existing) throw Object.assign(new Error('El docente ya tiene una llave prestada'), { statusCode: 409 });

    const diaActual = getDiaActual();
    const clases = await programacionRepository.findByDia(diaActual);
    const clase = clases.find(
      (c) =>
        String(c.numero_documento).replace('.0', '') === documento &&
        String(c.horario || '').trim() === String(horario || '').trim() &&
        String(c.aula || '').trim() === String(aula || '').trim()
    );

    if (!clase) throw Object.assign(new Error('Clase no encontrada en la programación'), { statusCode: 404 });

    const registro = await this._ejecutarPrestamo(docente, clase, true, '');
    return { ok: true, mensaje: `Llave entregada a ${docente.nombre}`, registro, docente };
  }

  /**
   * Entrega manual de llave (formulario) - Sin relación con programación
   */
  async registrarEntrega(infoClase) {
    const campos = ['nroidenti', 'profesor', 'aula'];
    for (const c of campos) {
      if (!infoClase[c]) throw Object.assign(new Error(`Campo '${c}' requerido`), { statusCode: 400 });
    }

    const documento = String(infoClase.nroidenti).replace('.0', '');
    const existing = await llaveRepository.findPendienteByDocumento(documento);
    if (existing) throw Object.assign(new Error('El docente ya tiene una llave prestada'), { statusCode: 409 });

    const ahora = new Date();
    const horario = (infoClase.hora_inicio && infoClase.hora_fin)
      ? `${infoClase.hora_inicio} A ${infoClase.hora_fin}`
      : '';

    const registro = {
      numero_documento: documento,
      docente: infoClase.profesor || '',
      dia: getDiaActual(),
      horario,
      aula: infoClase.aula,
      facultad: infoClase.facultad || 'No especificada',
      materia: infoClase.motivo || '',
      fecha_hora_entrega: ahora,
      fecha_hora_devolucion: null,
      duracion: '',
      duracion_clase: '',
      se_reclamo_a_tiempo: false,
      tiempo_retraso: '',
      retraso_entrega: false,
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
      throw Object.assign(new Error('No se encontró llave en préstamo para este docente'), { statusCode: 404 });
    }
    const result = await this._ejecutarDevolucion(registro);
    return { ok: true, ...result };
  }

  async exportarHistorial(filters = {}) {
    const result = await llaveRepository.findHistorial(filters);
    const registros = result.data || result;
    return generateExcel(registros, 'Historial Llaves');
  }

  // ── Métodos privados ────────────────────────────────────────────────────────

  _encontrarClaseActual(clases, minutosAhora) {
    let mejorClase = null;
    let menorDiff = Infinity;

    for (const clase of clases) {
      const horario = String(clase.horario || '').toUpperCase();
      const partes = horario.split(' A ');
      if (partes.length < 2) continue;
      const inicio = horaAMinutos(partes[0].trim());
      const fin = horaAMinutos(partes[1].trim());
      if (inicio === null || fin === null) continue;

      // Clase en curso o futura del día (no ya terminada)
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

  async _ejecutarPrestamo(docente, clase, seReclamoATiempo, tiempoRetraso) {
    const ahora = new Date();
    const registro = {
      numero_documento: String(docente.numero_documento).replace('.0', ''),
      docente: docente.nombre || '',
      dia: clase.dia || getDiaActual(),
      horario: clase.horario || '',
      aula: clase.aula || '',
      facultad: clase.facultad || 'No especificada',
      materia: clase.materia || '',
      fecha_hora_entrega: ahora,
      fecha_hora_devolucion: null,
      duracion: '',
      duracion_clase: '',
      se_reclamo_a_tiempo: seReclamoATiempo,
      tiempo_retraso: tiempoRetraso || '',
      retraso_entrega: false,
      tiempo_retraso_devolucion: '',
      estado: 'en_prestamo',
    };
    return llaveRepository.create(registro);
  }

  async _ejecutarDevolucion(registro) {
    const ahora = new Date();
    const duracion = calcularDuracion(registro.fecha_hora_entrega, ahora);
    const duracionClase = calcularDuracionClase(registro.horario, ahora);
    const fechaStr = registro.fecha_hora_entrega
      ? registro.fecha_hora_entrega.toISOString().split('T')[0]
      : getFechaHoy();
    const retrasoDevolucion = calcularRetrasoDevolucion(registro.horario, fechaStr, ahora);

    // Verificar si excedió el límite de horas
    const horasTranscurridas = registro.fecha_hora_entrega
      ? (ahora - registro.fecha_hora_entrega) / (1000 * 60 * 60)
      : 0;
    const esDemora = horasTranscurridas > LIMITE_HORAS_DEMORA;

    const updates = {
      fecha_hora_devolucion: ahora,
      duracion,
      duracion_clase: duracionClase,
      tiempo_retraso_devolucion: retrasoDevolucion,
      retraso_entrega: !!retrasoDevolucion,
      estado: esDemora ? 'demora_entrega' : 'entregado',
    };

    const updated = await llaveRepository.update(registro._id, updates);
    return { mensaje: `Llave devuelta por ${registro.docente}`, registro: updated };
  }

  _toClientFormat(r) {
    const formatDate = (d) => (d instanceof Date ? d.toISOString().split('T')[0] : '');
    const formatTime = (d) => (d instanceof Date ? d.toTimeString().split(' ')[0] : '');

    return {
      _id: r._id,
      documento: String(r.numero_documento).replace('.0', ''),
      docente: r.docente,
      dia: r.dia,
      horario: r.horario,
      aula: r.aula,
      facultad: r.facultad,
      materia: r.materia,
      fechaEntrega: formatDate(r.fecha_hora_entrega),
      horaEntrega: formatTime(r.fecha_hora_entrega),
      fechaDevolucion: formatDate(r.fecha_hora_devolucion),
      horaDevolucion: formatTime(r.fecha_hora_devolucion),
      duracion: r.duracion,
      duracionClase: r.duracion_clase,
      seReclamoATiempo: r.se_reclamo_a_tiempo,
      tiempoRetraso: r.tiempo_retraso,
      retrasoEntrega: r.retraso_entrega,
      tiempoRetrasoDevolucion: r.tiempo_retraso_devolucion,
      estado: r.estado,
    };
  }
}

module.exports = new LlaveService();
