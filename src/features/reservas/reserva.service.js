'use strict';
const reservaRepository = require('./reserva.repository');
const { Programacion } = require('../programacion/programacion.schema');
const { createLogger } = require('../../shared/utils/logger');

const logger = createLogger('Reservas');

const SLOTS = [];
for (let h = 7; h <= 21; h++) {
  SLOTS.push(`${String(h).padStart(2, '0')}:00`);
  if (h < 21) SLOTS.push(`${String(h).padStart(2, '0')}:30`);
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
    return reserva;
  }

  async listar(filters, pagination) {
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
    return reservaRepository.updateById(id, { estado: 'cancelada' });
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

  _nextSlot(slot) {
    const [h, m] = slot.split(':').map(Number);
    if (m === 0) return `${String(h).padStart(2, '0')}:30`;
    return `${String(h + 1).padStart(2, '0')}:00`;
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
