'use strict';
const reservaRepository = require('./reserva.repository');
const { Programacion } = require('../programacion/programacion.schema');
const { Llave } = require('../llaves/llave.schema');
const { Reserva } = require('./reserva.schema');
const {
  UBICACIONES: { OFICINA: UBICACION_OFICINA },
} = require('../../shared/constants/nfc.constants');
const { createLogger } = require('../../shared/utils/logger');

const DIAS_ES = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
const ZONA_HORARIA_APP = 'America/Bogota';

const logger = createLogger('Reservas');

const SLOTS = [];
for (let h = 7; h <= 22; h++) {
  SLOTS.push(`${String(h).padStart(2, '0')}:00`);
  if (h < 22) SLOTS.push(`${String(h).padStart(2, '0')}:30`);
}

class ReservaService {
  async _buscarConflictos(datos) {
    const conflictos = [];

    // Conflictos con otras reservas
    const resConflictos = await reservaRepository.findConflictos(
      datos.nombre_salon,
      datos.fecha,
      datos.hora_inicio,
      datos.hora_fin
    );
    resConflictos.forEach((c) =>
      conflictos.push({ tipo: 'reserva', detalle: `${c.solicitante_nombre || 'Reserva'} (${c.hora_inicio}-${c.hora_fin})`, data: c })
    );

    // Conflictos con programación académica
    const diaMap = { 0: 'DOMINGO', 1: 'LUNES', 2: 'MARTES', 3: 'MIERCOLES', 4: 'JUEVES', 5: 'VIERNES', 6: 'SABADO' };
    const fechaObj = new Date(`${datos.fecha}T12:00:00`);
    const diaSemana = diaMap[fechaObj.getDay()] || '';

    if (diaSemana) {
      const progSalon = await Programacion.find({
        aula: datos.nombre_salon,
        dia: new RegExp(diaSemana, 'i'),
      }).lean();

      for (const p of progSalon) {
        if (p.hora_inicio && p.hora_fin) {
          if (p.hora_inicio < datos.hora_fin && p.hora_fin > datos.hora_inicio) {
            conflictos.push({
              tipo: 'programacion',
              detalle: `${p.docente || 'Docente'} — ${p.materia || ''} (${p.hora_inicio}-${p.hora_fin})`,
              data: p,
            });
          }
        }
      }
    }

    return conflictos;
  }

  async validar(datos) {
    const conflictos = await this._buscarConflictos(datos);
    return { tiene_conflictos: conflictos.length > 0, conflictos };
  }

  async crear(datos) {
    if (!datos.forzar) {
      const conflictos = await this._buscarConflictos(datos);
      if (conflictos.length > 0) {
        const ApiError = require('../../shared/errors/api.error');
        const primero = conflictos[0];
        throw ApiError.conflict(
          primero.tipo === 'programacion'
            ? `Conflicto con programación académica: ${primero.detalle}`
            : `Ya existe una reserva en ese horario para ese salón: ${primero.detalle}`
        );
      }
    }

    const reserva = await reservaRepository.create(datos);
    logger.info('Reserva creada', { id: reserva._id, salon: datos.nombre_salon, fecha: datos.fecha });

    if (datos.entregar_llave !== false) {
      const fechaObj = new Date(`${datos.fecha}T12:00:00`);
      const dia = DIAS_ES[fechaObj.getDay()] || '';
      const ahora = new Date();
      const responsableEsValido = datos.tipo_solicitante === 'estudiante'
        && String(datos.responsable_documento || '').trim()
        && String(datos.responsable_nombre || '').trim();
      const documentoReclama = responsableEsValido ? datos.responsable_documento : datos.solicitante_documento;
      const nombreReclama = responsableEsValido ? datos.responsable_nombre : datos.solicitante_nombre;
      const quienReclama = responsableEsValido ? 'docente' : (datos.tipo_solicitante === 'estudiante' ? 'monitor' : 'docente');

      const prestamo = await Llave.create({
        numero_documento: datos.solicitante_documento,
        docente: datos.solicitante_nombre,
        aula: datos.nombre_salon,
        horario: `${datos.hora_inicio} A ${datos.hora_fin}`,
        dia,
        fecha_hora_entrega: ahora,
        se_reclamo_a_tiempo: true,
        estado: 'en_prestamo',
        tipo_entrega: 'manual',
        origen_registro: 'individual',
        ubicacion_prestamo: UBICACION_OFICINA,
        quien_reclama: quienReclama,
        numero_documento_reclama: documentoReclama,
        nombre_reclama: nombreReclama,
      });
      await Reserva.updateOne(
        { _id: reserva._id },
        {
          $set: {
            llave_entregada: true,
            llave_prestamo_id: prestamo._id,
            checkin_estado: 'entregado_oficina',
            checkin_canal: 'oficina',
            checkin_at: new Date(),
          },
        }
      );
      logger.info('Llave entregada al crear reserva', { salon: datos.nombre_salon });
    } else {
      await Reserva.updateOne(
        { _id: reserva._id },
        {
          $set: {
            checkin_estado: 'pendiente_nfc',
          },
        }
      );
    }

    return reserva;
  }

  async sincronizarEstadosVencidos() {
    const now = new Date();
    const hoy = now.toLocaleDateString('en-CA', {
      timeZone: ZONA_HORARIA_APP,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const horaActual = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    await reservaRepository.bulkCompletarVencidas(hoy, horaActual);
  }

  async listar(filters, pagination) {
    await this.sincronizarEstadosVencidos();
    return reservaRepository.findHistorial(filters, pagination);
  }

  async aprobar(id, aprobadoPor) {
    const reserva = await this._obtener(id);
    if (reserva.estado !== 'pendiente') {
      const ApiError = require('../../shared/errors/api.error');
      throw ApiError.badRequest(`No se puede aprobar una reserva en estado "${reserva.estado}"`);
    }
    return reservaRepository.updateById(id, { estado: 'aprobada', aprobado_por: aprobadoPor });
  }

  async rechazar(id, aprobadoPor) {
    const reserva = await this._obtener(id);
    if (reserva.estado !== 'pendiente') {
      const ApiError = require('../../shared/errors/api.error');
      throw ApiError.badRequest(`No se puede rechazar una reserva en estado "${reserva.estado}"`);
    }
    return reservaRepository.updateById(id, { estado: 'rechazada', aprobado_por: aprobadoPor });
  }

  async cancelar(id) {
    const reserva = await this._obtener(id);
    if (!['pendiente', 'aprobada'].includes(reserva.estado)) {
      const ApiError = require('../../shared/errors/api.error');
      throw ApiError.badRequest(`No se puede cancelar una reserva en estado "${reserva.estado}"`);
    }

    const fechaHoraInicio = this._fechaHoraInicioReserva(reserva);
    if (!fechaHoraInicio || new Date() >= fechaHoraInicio) {
      const ApiError = require('../../shared/errors/api.error');
      throw ApiError.badRequest('Solo se puede cancelar una reserva antes de su hora de inicio');
    }

    let devolucionAutomaticaRegistrada = false;
    if (reserva.llave_entregada) {
      devolucionAutomaticaRegistrada = await this._registrarDevolucionAutomaticaPorCancelacion(reserva);
    }

    const actualizada = await reservaRepository.updateById(id, { estado: 'cancelada' });
    return {
      ...actualizada,
      devolucion_automatica_registrada: devolucionAutomaticaRegistrada,
    };
  }

  async disponibilidad(nombre_salon, fecha) {
    const reservas = await reservaRepository.findBySalonYFecha(nombre_salon, fecha);

    // Obtener programación académica para ese día
    const diaMap = { 0: 'DOMINGO', 1: 'LUNES', 2: 'MARTES', 3: 'MIERCOLES', 4: 'JUEVES', 5: 'VIERNES', 6: 'SABADO' };
    const fechaObj = new Date(`${fecha}T12:00:00`);
    const diaSemana = diaMap[fechaObj.getDay()] || '';

    let progAcademica = [];
    if (diaSemana) {
      progAcademica = await Programacion.find({
        aula: nombre_salon,
        dia: new RegExp(diaSemana, 'i'),
      }).lean();
    }

    // Generar la lista de slots con su estado
    const slots = SLOTS.map((slot) => {
      const nextSlot = this._nextSlot(slot);

      // Verificar si está ocupado por programación
      const progConflicto = progAcademica.find((p) =>
        p.hora_inicio && p.hora_fin && p.hora_inicio < nextSlot && p.hora_fin > slot
      );
      if (progConflicto) {
        return { hora: slot, disponible: false, motivo: 'programacion', detalle: progConflicto.materia || 'Clase programada' };
      }

      // Verificar si está ocupado por reserva
      const resConflicto = reservas.find((r) =>
        r.hora_inicio < nextSlot && r.hora_fin > slot
      );
      if (resConflicto) {
        return { hora: slot, disponible: false, motivo: 'reserva', detalle: resConflicto.solicitante_nombre };
      }

      return { hora: slot, disponible: true };
    });

    return { nombre_salon, fecha, slots };
  }

  async disponibilidadSmart(nombre_salon, fecha) {
    const reservas = await reservaRepository.findBySalonYFecha(nombre_salon, fecha);

    const diaMap = { 0: 'DOMINGO', 1: 'LUNES', 2: 'MARTES', 3: 'MIERCOLES', 4: 'JUEVES', 5: 'VIERNES', 6: 'SABADO' };
    const fechaObj = new Date(`${fecha}T12:00:00`);
    const diaSemana = diaMap[fechaObj.getDay()] || '';

    let progAcademica = [];
    if (diaSemana) {
      progAcademica = await Programacion.find({
        aula: nombre_salon,
        dia: new RegExp(diaSemana, 'i'),
      }).lean();
    }

    // Check for an active key loan in this salon on this date
    const startOfDay = new Date(`${fecha}T00:00:00`);
    const endOfDay = new Date(`${fecha}T23:59:59`);
    const llaveActiva = await Llave.findOne({
      aula: nombre_salon,
      estado: 'en_prestamo',
      fecha_hora_entrega: { $gte: startOfDay, $lte: endOfDay },
    }).lean();

    const slots = SLOTS.map((slot) => {
      const nextSlot = this._nextSlot(slot);

      const progConflicto = progAcademica.find((p) =>
        p.hora_inicio && p.hora_fin && p.hora_inicio < nextSlot && p.hora_fin > slot
      );
      if (progConflicto) {
        if (llaveActiva) {
          return { hora: slot, disponible: false, motivo: 'programacion_con_llave', detalle: 'Salón en uso — llave prestada' };
        }
        return { hora: slot, disponible: true, motivo: 'programacion_sin_llave', detalle: progConflicto.materia || 'Clase programada sin llave reclamada' };
      }

      const resConflicto = reservas.find((r) => r.hora_inicio < nextSlot && r.hora_fin > slot);
      if (resConflicto) {
        return { hora: slot, disponible: false, motivo: 'reserva', detalle: resConflicto.solicitante_nombre };
      }

      return { hora: slot, disponible: true };
    });

    return { nombre_salon, fecha, slots };
  }

  async salonesDisponibles(fecha, hora_inicio, hora_fin) {
    const { Salon } = require('../salones/salon.schema');
    const salones = await Salon.find().lean();

    const results = await Promise.all(
      salones.map(async (salon) => {
        const conflictos = await this._buscarConflictos({
          nombre_salon: salon.nombre_salon,
          fecha,
          hora_inicio,
          hora_fin,
        });
        return { ...salon, disponible: conflictos.length === 0 };
      })
    );

    return results.filter((s) => s.disponible);
  }

  _nextSlot(slot) {
    const [h, m] = slot.split(':').map(Number);
    if (m === 0) return `${String(h).padStart(2, '0')}:30`;
    return `${String(h + 1).padStart(2, '0')}:00`;
  }

  _calcularDuracion(fechaInicio, fechaFin = new Date()) {
    const inicio = fechaInicio instanceof Date ? fechaInicio : new Date(fechaInicio);
    if (Number.isNaN(inicio.getTime())) return '';

    const diffMs = Math.max(0, fechaFin - inicio);
    const horas = Math.floor(diffMs / (1000 * 60 * 60));
    const minutos = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${horas}h ${minutos}min`;
  }

  async _registrarDevolucionAutomaticaPorCancelacion(reserva) {
    const ahora = new Date();

    let prestamo = null;
    if (reserva.llave_prestamo_id) {
      prestamo = await Llave.findById(reserva.llave_prestamo_id).lean();
    }

    if (!prestamo) {
      const fechaRef = new Date(reserva.fecha);
      const diaStart = new Date(fechaRef); diaStart.setHours(0, 0, 0, 0);
      const diaEnd = new Date(fechaRef); diaEnd.setHours(23, 59, 59, 999);
      prestamo = await Llave.findOne({
        aula: reserva.nombre_salon,
        numero_documento: reserva.solicitante_documento,
        fecha_hora_entrega: { $gte: diaStart, $lte: diaEnd },
      }).sort({ fecha_hora_entrega: -1 }).lean();
    }

    if (!prestamo) return false;
    if (prestamo.estado !== 'en_prestamo') return true;

    await Llave.updateOne(
      { _id: prestamo._id },
      {
        $set: {
          fecha_hora_devolucion: ahora,
          duracion: this._calcularDuracion(prestamo.fecha_hora_entrega, ahora),
          tiempo_retraso_devolucion: '',
          retraso_entrega: false,
          estado: 'entregado',
          tipo_devolucion: 'manual',
          ubicacion_devolucion: UBICACION_OFICINA,
          quien_entrega: 'docente',
          numero_documento_entrega: reserva.solicitante_documento,
          nombre_entrega: reserva.solicitante_nombre,
        },
      }
    );

    return true;
  }

  _fechaHoraInicioReserva(reserva) {
    if (!reserva?.fecha || !reserva?.hora_inicio) return null;

    const fecha = new Date(reserva.fecha);
    if (Number.isNaN(fecha.getTime())) return null;

    const yyyy = String(fecha.getUTCFullYear());
    const mm = String(fecha.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(fecha.getUTCDate()).padStart(2, '0');
    const fechaHora = new Date(`${yyyy}-${mm}-${dd}T${reserva.hora_inicio}:00`);

    return Number.isNaN(fechaHora.getTime()) ? null : fechaHora;
  }

  async _obtener(id) {
    const reserva = await reservaRepository.findById(id);
    if (!reserva) {
      const ApiError = require('../../shared/errors/api.error');
      throw ApiError.notFound('Reserva no encontrada');
    }
    return reserva;
  }
}

module.exports = new ReservaService();
