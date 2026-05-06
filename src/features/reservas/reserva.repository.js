'use strict';
const { Reserva } = require('./reserva.schema');
const { applyPagination } = require('../../shared/utils/pagination.helper');

class ReservaRepository {
  async create(data) {
    return Reserva.create(data);
  }

  async findById(id) {
    return Reserva.findById(id).lean();
  }

  async updateById(id, updates) {
    return Reserva.findByIdAndUpdate(id, { $set: updates }, { new: true }).lean();
  }

  async findHistorial(filters = {}, pagination = null) {
    const query = {};
    if (filters.nombre_bloque) query.nombre_bloque = filters.nombre_bloque;
    if (filters.nombre_salon) query.nombre_salon = filters.nombre_salon;
    if (filters.estado) query.estado = filters.estado;
    if (filters.solicitante_documento) query.solicitante_documento = filters.solicitante_documento;
    if (filters.fecha) {
      const start = new Date(`${filters.fecha}T00:00:00`);
      const end = new Date(`${filters.fecha}T23:59:59.999`);
      query.fecha = { $gte: start, $lte: end };
    }
    if (filters.busqueda) {
      const escaped = String(filters.busqueda).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      query.$or = [
        { solicitante_nombre: regex },
        { solicitante_documento: regex },
        { motivo: regex },
      ];
    }
    return applyPagination(Reserva.find(query).sort({ fecha: -1, hora_inicio: 1 }), pagination);
  }

  /**
   * Busca reservas activas que se solapen con el rango horario dado en un salón y fecha.
   */
  async findConflictos(nombre_salon, fecha, hora_inicio, hora_fin, excludeId = null) {
    const start = new Date(`${fecha}T00:00:00`);
    const end = new Date(`${fecha}T23:59:59.999`);
    const query = {
      nombre_salon,
      fecha: { $gte: start, $lte: end },
      estado: { $in: ['pendiente', 'aprobada'] },
      $or: [
        { hora_inicio: { $lt: hora_fin }, hora_fin: { $gt: hora_inicio } },
      ],
    };
    if (excludeId) query._id = { $ne: excludeId };
    return Reserva.find(query).lean();
  }

  /**
   * Obtiene todas las reservas activas de un salón en una fecha dada.
   */
  async bulkCompletarVencidas(fechaHoy, horaActual) {
    const { Llave } = require('../llaves/llave.schema');
    const { Notificacion } = require('../notificaciones/notificacion.schema');
    const comunidadRepository = require('../comunidad/comunidad.repository');
    const configuracionService = require('../configuracion/configuracion.service');

    const hoyStart = new Date(`${fechaHoy}T00:00:00`);
    const hoyEnd = new Date(`${fechaHoy}T23:59:59.999`);

    const vencidas = await Reserva.find({
      estado: { $in: ['pendiente', 'aprobada'] },
      $or: [
        { fecha: { $lt: hoyStart } },
        { fecha: { $gte: hoyStart, $lte: hoyEnd }, hora_fin: { $lte: horaActual } },
      ],
    }).lean();

    for (const reserva of vencidas) {
      let nuevoEstado;
      let nextCheckinEstado = reserva.checkin_estado || (reserva.entregar_llave === false ? 'pendiente_nfc' : 'entregado_oficina');

      if (reserva.llave_entregada) {
        nuevoEstado = 'completada';
      } else if (reserva.entregar_llave === false) {
        let llave = null;

        if (reserva.llave_prestamo_id) {
          llave = await Llave.findById(reserva.llave_prestamo_id).lean();
        }

        // Compatibilidad hacia atrás para reservas históricas sin enlace directo.
        if (!llave) {
          const fechaObj = new Date(reserva.fecha);
          const diaStart = new Date(fechaObj); diaStart.setHours(0, 0, 0, 0);
          const diaEnd = new Date(fechaObj); diaEnd.setHours(23, 59, 59, 999);
          llave = await Llave.findOne({
            aula: reserva.nombre_salon,
            numero_documento: reserva.solicitante_documento,
            fecha_hora_entrega: { $gte: diaStart, $lte: diaEnd },
          }).lean();
        }

        nuevoEstado = llave ? 'completada' : 'no_reclamada';
        if (llave) {
          if (nextCheckinEstado === 'pendiente_nfc') {
            nextCheckinEstado = 'nfc_en_tiempo';
          }
        } else {
          nextCheckinEstado = 'no_show';
        }
      } else {
        nuevoEstado = 'no_reclamada';
        nextCheckinEstado = 'no_show';
      }

      await Reserva.updateOne(
        { _id: reserva._id },
        {
          $set: {
            estado: nuevoEstado,
            checkin_estado: nextCheckinEstado,
          },
        }
      );

      if (nuevoEstado === 'no_reclamada') {
        try {
          const bloque = reserva.nombre_bloque || '';
          const config = await configuracionService.obtenerPorBloque(bloque);
          if (!config.notificaciones_activas) continue;

          const persona = await comunidadRepository.findByDocumento(reserva.solicitante_documento);
          if (!persona?.correo) continue;

          const fechaStr = new Date(reserva.fecha).toLocaleDateString('es-CO', {
            timeZone: 'America/Bogota', year: 'numeric', month: 'long', day: 'numeric',
          });

          await Notificacion.updateOne(
            {
              reserva_id: reserva._id,
              tipo_notificacion: 'reserva_no_reclamada',
            },
            {
              $setOnInsert: {
                destinatario_nombre: reserva.solicitante_nombre,
                destinatario_documento: reserva.solicitante_documento,
                destinatario_correo: persona.correo,
                tipo_mensaje: 'predeterminado',
                asunto: 'Reserva finalizada — Llave no reclamada - AulaSync',
                salon: reserva.nombre_salon,
                tipo_notificacion: 'reserva_no_reclamada',
                estado_envio: 'pendiente',
                enviado_por: 'sistema',
                fecha_envio: new Date(),
                reserva_id: reserva._id,
                reserva_fecha: fechaStr,
                reserva_hora_inicio: reserva.hora_inicio,
                reserva_hora_fin: reserva.hora_fin,
              },
            },
            { upsert: true }
          );
        } catch (_) {
          // no bloquear el flujo principal si falla la notificación
        }
      }
    }
  }

  async findBySalonYFecha(nombre_salon, fecha) {
    const start = new Date(`${fecha}T00:00:00`);
    const end = new Date(`${fecha}T23:59:59.999`);
    return Reserva.find({
      nombre_salon,
      fecha: { $gte: start, $lte: end },
      estado: { $in: ['pendiente', 'aprobada'] },
    }).sort({ hora_inicio: 1 }).lean();
  }

  async findReservaPendienteNFCByDocumento(documento, now = new Date()) {
    const fecha = now.toISOString().split('T')[0];
    const start = new Date(`${fecha}T00:00:00`);
    const end = new Date(`${fecha}T23:59:59.999`);
    const horaActual = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const candidatas = await Reserva.find({
      solicitante_documento: documento,
      fecha: { $gte: start, $lte: end },
      estado: { $in: ['pendiente', 'aprobada'] },
      entregar_llave: false,
      llave_entregada: false,
      $or: [
        { checkin_estado: 'pendiente_nfc' },
        { checkin_estado: { $exists: false } },
      ],
      hora_fin: { $gte: horaActual },
    }).sort({ hora_inicio: 1 }).lean();

    if (!candidatas.length) return null;

    const ahoraMin = (now.getHours() * 60) + now.getMinutes();
    const toMin = (hhmm) => {
      const [h, m] = String(hhmm || '').split(':').map(Number);
      if (Number.isNaN(h) || Number.isNaN(m)) return null;
      return (h * 60) + m;
    };

    let mejor = candidatas[0];
    let mejorScore = Number.POSITIVE_INFINITY;
    for (const reserva of candidatas) {
      const inicio = toMin(reserva.hora_inicio);
      const fin = toMin(reserva.hora_fin);
      if (inicio === null || fin === null) continue;

      let score;
      if (ahoraMin < inicio) score = inicio - ahoraMin;
      else if (ahoraMin <= fin) score = 0;
      else score = Number.POSITIVE_INFINITY;

      if (score < mejorScore) {
        mejorScore = score;
        mejor = reserva;
      }
    }

    return mejor;
  }

  async marcarCheckinNFC({ reservaId, llavePrestamoId, checkinEstado, now = new Date() }) {
    return Reserva.findOneAndUpdate(
      {
        _id: reservaId,
        llave_entregada: false,
        $or: [
          { checkin_estado: 'pendiente_nfc' },
          { checkin_estado: { $exists: false } },
        ],
      },
      {
        $set: {
          llave_entregada: true,
          llave_prestamo_id: llavePrestamoId,
          checkin_estado: checkinEstado,
          checkin_canal: 'nfc',
          checkin_at: now,
        },
      },
      { new: true }
    ).lean();
  }
}

module.exports = new ReservaRepository();
