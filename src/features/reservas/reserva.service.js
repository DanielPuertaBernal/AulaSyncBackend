'use strict';
const reservaRepository = require('./reserva.repository');
const comunidadRepository = require('../comunidad/comunidad.repository');
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
for (let h = 6; h <= 23; h++) {
  SLOTS.push(`${String(h).padStart(2, '0')}:00`);
  SLOTS.push(`${String(h).padStart(2, '0')}:30`);
}

/** Convierte "H:MM" o "HH:MM" a minutos. Evita bugs de comparación lexicográfica con horas sin cero inicial. */
const toMin = (t) => { const [h, m] = String(t || '0:0').split(':').map(Number); return h * 60 + (m || 0); };
/** Regex por día de semana (índice 0=Dom..6=Sáb). Cubre nombres con y sin tilde (MIÉRCOLES/MIERCOLES, SÁBADO/SABADO). */
const DIA_REGEX = [/domingo/i, /lunes/i, /martes/i, /mi[eé]rcoles/i, /jueves/i, /viernes/i, /s[aá]bado/i];

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

    // Conflictos con programación académica y semestrales
    const fechaObj = new Date(`${datos.fecha}T12:00:00`);
    const diaRegex = DIA_REGEX[fechaObj.getDay()];

    if (diaRegex) {
      // Solo muestra clases cuyo semestre cubre la fecha de la reserva
      const progSalon = await Programacion.find({
        aula: datos.nombre_salon,
        dia: diaRegex,
        tipo: 'programacion',
        fecha_inicio_semestre: { $lte: fechaObj },
        fecha_fin_semestre: { $gte: fechaObj },
      }).lean();

      for (const p of progSalon) {
        if (p.hora_inicio && p.hora_fin) {
          if (toMin(p.hora_inicio) < toMin(datos.hora_fin) && toMin(p.hora_fin) > toMin(datos.hora_inicio)) {
            conflictos.push({
              tipo: 'programacion',
              detalle: `${p.docente || 'Docente'} — ${p.materia || ''} (${p.hora_inicio}-${p.hora_fin})`,
              data: p,
            });
          }
        }
      }

      // Conflictos con reservas semestrales cuyo rango de vigencia cubre la fecha
      const semestrales = await Programacion.find({
        tipo: 'semestral',
        aula: datos.nombre_salon,
        dia: diaRegex,
        fecha_inicio_semestre: { $lte: fechaObj },
        fecha_fin_semestre: { $gte: fechaObj },
        i_cancelada: { $ne: 1 },
      }).lean();
      for (const s of semestrales) {
        if (s.hora_inicio && s.hora_fin && toMin(s.hora_inicio) < toMin(datos.hora_fin) && toMin(s.hora_fin) > toMin(datos.hora_inicio)) {
          conflictos.push({
            tipo: 'semestral',
            detalle: `${s.docente || 'Docente'} — ${s.materia || ''} (${s.hora_inicio}-${s.hora_fin})`,
            data: s,
          });
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
    if (toMin(datos.hora_fin) <= toMin(datos.hora_inicio)) {
      const ApiError = require('../../shared/errors/api.error');
      throw ApiError.badRequest('La hora de fin debe ser posterior a la hora de inicio');
    }
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
    const resultado = await reservaRepository.findHistorial(filters, pagination);

    // Enriquecer con correo de comunidad cuando se listan reservas no reclamadas
    if (filters?.estado === 'no_reclamada') {
      const reservas = Array.isArray(resultado) ? resultado : (resultado?.reservas ?? resultado?.data ?? []);
      const documentos = [...new Set(reservas.map((r) => r.solicitante_documento).filter(Boolean))];
      if (documentos.length) {
        const personas = await comunidadRepository.findManyByDocumentos(documentos);
        const correoMap = new Map(personas.map((p) => [p.numero_documento, p.correo]));
        const enriquecidas = reservas.map((r) => ({
          ...r,
          solicitante_correo: correoMap.get(r.solicitante_documento) || '',
        }));
        if (Array.isArray(resultado)) return enriquecidas;
        return { ...resultado, reservas: enriquecidas, data: enriquecidas };
      }
    }

    return resultado;
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

    const fechaHoraFin = this._fechaHoraFinReserva(reserva);
    if (!fechaHoraFin || new Date() >= fechaHoraFin) {
      const ApiError = require('../../shared/errors/api.error');
      throw ApiError.badRequest('Solo se puede cancelar una reserva antes de su hora de fin');
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

  async editar(id, datos) {
    const ApiError = require('../../shared/errors/api.error');
    const reserva = await this._obtener(id);

    if (!['pendiente', 'aprobada'].includes(reserva.estado)) {
      throw ApiError.badRequest(`No se puede editar una reserva en estado "${reserva.estado}"`);
    }

    const fechaHoraFin = this._fechaHoraFinReserva(reserva);
    const now = new Date();

    if (!fechaHoraFin || now >= fechaHoraFin) {
      throw ApiError.badRequest('La reserva ya ha finalizado y no puede ser editada');
    }

    // Effective values: new data takes precedence over existing reservation values
    const fechaBase = new Date(reserva.fecha);
    const fechaStrActual = `${fechaBase.getUTCFullYear()}-${String(fechaBase.getUTCMonth() + 1).padStart(2, '0')}-${String(fechaBase.getUTCDate()).padStart(2, '0')}`;
    const nuevoSalon = datos.nombre_salon || reserva.nombre_salon;
    const nuevaFechaStr = datos.fecha || fechaStrActual;
    const nuevoHoraInicio = datos.hora_inicio || reserva.hora_inicio;
    const nuevoHoraFin = datos.hora_fin || reserva.hora_fin;

    if (toMin(nuevoHoraFin) <= toMin(nuevoHoraInicio)) {
      throw ApiError.badRequest('La hora de fin debe ser posterior a la hora de inicio');
    }

    const nuevaFechaFin = new Date(`${nuevaFechaStr}T${nuevoHoraFin}:00`);
    if (!nuevaFechaFin || Number.isNaN(nuevaFechaFin.getTime()) || nuevaFechaFin <= now) {
      throw ApiError.badRequest('La nueva hora de fin no puede estar en el pasado');
    }

    if (!datos.forzar) {
      const conflictosReserva = await reservaRepository.findConflictos(
        nuevoSalon, nuevaFechaStr, nuevoHoraInicio, nuevoHoraFin, id
      );
      if (conflictosReserva.length > 0) {
        const c = conflictosReserva[0];
        const quien = c.solicitante_nombre || 'otro solicitante';
        const motivo = c.motivo ? ` — motivo: «${c.motivo}»` : '';
        throw ApiError.conflict(`Conflicto con reserva de ${quien}${motivo} — ${c.hora_inicio}–${c.hora_fin}`);
      }

      // También verificar cruces con programación académica y semestral
      const fechaObjEdit = new Date(`${nuevaFechaStr}T12:00:00`);
      const diaRegexEdit = DIA_REGEX[fechaObjEdit.getDay()];
      if (diaRegexEdit) {
        const [progAcademicaEdit, progSemestralEdit] = await Promise.all([
          Programacion.find({
            aula: nuevoSalon, dia: diaRegexEdit, tipo: 'programacion',
            fecha_inicio_semestre: { $lte: fechaObjEdit },
            fecha_fin_semestre: { $gte: fechaObjEdit },
          }).lean(),
          Programacion.find({
            tipo: 'semestral', aula: nuevoSalon, dia: diaRegexEdit,
            fecha_inicio_semestre: { $lte: fechaObjEdit },
            fecha_fin_semestre: { $gte: fechaObjEdit },
            i_cancelada: { $ne: 1 },
          }).lean(),
        ]);
        const cruceClase = [...progAcademicaEdit, ...progSemestralEdit].find(
          (p) => p.hora_inicio && p.hora_fin
            && toMin(p.hora_inicio) < toMin(nuevoHoraFin)
            && toMin(p.hora_fin) > toMin(nuevoHoraInicio)
        );
        if (cruceClase) {
          const tipo = cruceClase.tipo === 'semestral' ? 'clase semestral' : 'clase programada';
          const materia = cruceClase.materia || '';
          const docente = cruceClase.docente || '';
          const detallClase = [materia, docente].filter(Boolean).join(' — ');
          const detallMsg = detallClase ? ` «${detallClase}»` : '';
          throw ApiError.conflict(`Conflicto con ${tipo}${detallMsg} — ${cruceClase.hora_inicio}–${cruceClase.hora_fin}`);
        }
      }
    }

    const updates = {};
    if (datos.nombre_bloque !== undefined) updates.nombre_bloque = datos.nombre_bloque;
    if (datos.nombre_salon !== undefined) updates.nombre_salon = datos.nombre_salon;
    if (datos.fecha !== undefined) updates.fecha = new Date(`${datos.fecha}T12:00:00Z`);
    if (datos.hora_inicio !== undefined) updates.hora_inicio = datos.hora_inicio;
    if (datos.hora_fin !== undefined) updates.hora_fin = datos.hora_fin;
    if (datos.motivo !== undefined) updates.motivo = datos.motivo;

    const reservaActualizada = await reservaRepository.updateById(id, updates);
    logger.info('Reserva editada', { id, updates });
    return reservaActualizada;
  }

  async disponibilidad(nombre_salon, fecha) {
    const reservas = await reservaRepository.findBySalonYFecha(nombre_salon, fecha);

    // Obtener programación académica y semestral para ese día
    const fechaObj = new Date(`${fecha}T12:00:00`);
    const diaRegex = DIA_REGEX[fechaObj.getDay()];

    let progAcademica = [];
    let progSemestral = [];
    if (diaRegex) {
      [progAcademica, progSemestral] = await Promise.all([
        Programacion.find({
          aula: nombre_salon,
          dia: diaRegex,
          tipo: 'programacion',
          fecha_inicio_semestre: { $lte: fechaObj },
          fecha_fin_semestre: { $gte: fechaObj },
        }).lean(),
        Programacion.find({
          tipo: 'semestral',
          aula: nombre_salon,
          dia: diaRegex,
          fecha_inicio_semestre: { $lte: fechaObj },
          fecha_fin_semestre: { $gte: fechaObj },
          i_cancelada: { $ne: 1 },
        }).lean(),
      ]);
    }

    // Convierte "H:MM" o "HH:MM" a minutos para comparación robusta
    const toMin = (t) => { const [h, m] = String(t || '0:0').split(':').map(Number); return h * 60 + (m || 0); };

    // Generar la lista de slots con su estado
    const slots = SLOTS.map((slot) => {
      const nextSlot = this._nextSlot(slot);
      const slotMin = toMin(slot);
      const nextMin = toMin(nextSlot);

      // Verificar si está ocupado por reserva normal (se calcula antes para reserva_solapada)
      const resConflicto = reservas.find((r) =>
        toMin(r.hora_inicio) < nextMin && toMin(r.hora_fin) > slotMin
      );

      // Verificar si está ocupado por programación académica
      const progConflicto = progAcademica.find((p) =>
        p.hora_inicio && p.hora_fin && toMin(p.hora_inicio) < nextMin && toMin(p.hora_fin) > slotMin
      );
      const reservaDetalle = resConflicto
        ? [resConflicto.solicitante_nombre, resConflicto.motivo].filter(Boolean).join(' — ') || 'Reserva'
        : undefined;

      if (progConflicto) {
        return {
          hora: slot, disponible: false, motivo: 'programacion',
          detalle: [progConflicto.docente, progConflicto.materia].filter(Boolean).join(' — ') || 'Clase programada',
          ...(resConflicto ? { reserva_solapada: true, reserva_detalle: reservaDetalle } : {}),
        };
      }

      // Verificar si está ocupado por reserva semestral
      const semConflicto = progSemestral.find((s) =>
        s.hora_inicio && s.hora_fin && toMin(s.hora_inicio) < nextMin && toMin(s.hora_fin) > slotMin
      );
      if (semConflicto) {
        return {
          hora: slot, disponible: false, motivo: 'semestral',
          detalle: [semConflicto.docente, semConflicto.materia].filter(Boolean).join(' — ') || 'Reserva semestral',
          ...(resConflicto ? { reserva_solapada: true, reserva_detalle: reservaDetalle } : {}),
        };
      }

      if (resConflicto) {
        return {
          hora: slot, disponible: false, motivo: 'reserva',
          detalle: [resConflicto.solicitante_nombre, resConflicto.motivo].filter(Boolean).join(' — ') || 'Reserva',
        };
      }

      return { hora: slot, disponible: true };
    });

    return { nombre_salon, fecha, slots };
  }

  async disponibilidadSmart(nombre_salon, fecha) {
    const reservas = await reservaRepository.findBySalonYFecha(nombre_salon, fecha);

    const fechaObj = new Date(`${fecha}T12:00:00`);
    const diaRegex = DIA_REGEX[fechaObj.getDay()];

    let progAcademica = [];
    if (diaRegex) {
      const fechaObjSmart = new Date(`${fecha}T12:00:00`);
      progAcademica = await Programacion.find({
        aula: nombre_salon,
        dia: diaRegex,
        tipo: 'programacion',
        fecha_inicio_semestre: { $lte: fechaObjSmart },
        fecha_fin_semestre: { $gte: fechaObjSmart },
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

    const fechaObj = new Date(`${fecha}T12:00:00`);
    const diaRegex = DIA_REGEX[fechaObj.getDay()];
    const horaInicioMin = toMin(hora_inicio);
    const horaFinMin = toMin(hora_fin);

    // Expresión MongoDB: convierte campo de hora "H:MM" / "HH:MM" a minutos (maneja datos sin cero inicial)
    const campoToMin = (campo) => ({
      $add: [
        { $multiply: [{ $toInt: { $arrayElemAt: [{ $split: [`$${campo}`, ':'] }, 0] } }, 60] },
        { $toInt: { $arrayElemAt: [{ $split: [`$${campo}`, ':'] }, 1] } },
      ],
    });
    const overlapExpr = [
      { $lt: [campoToMin('hora_inicio'), horaFinMin] },
      { $gt: [campoToMin('hora_fin'), horaInicioMin] },
    ];

    const fechaObjDisp = new Date(`${fecha}T12:00:00`);

    const [ocupadosProg, ocupadosSem, ocupadosRes] = await Promise.all([
      diaRegex ? Programacion.distinct('aula', {
        tipo: 'programacion',
        dia: diaRegex,
        fecha_inicio_semestre: { $lte: fechaObjDisp },
        fecha_fin_semestre: { $gte: fechaObjDisp },
        $expr: { $and: overlapExpr },
      }) : Promise.resolve([]),
      diaRegex ? Programacion.distinct('aula', {
        tipo: 'semestral',
        dia: diaRegex,
        fecha_inicio_semestre: { $lte: fechaObjDisp },
        fecha_fin_semestre: { $gte: fechaObjDisp },
        i_cancelada: { $ne: 1 },
        $expr: { $and: overlapExpr },
      }) : Promise.resolve([]),
      Reserva.distinct('nombre_salon', {
        estado: { $nin: ['cancelada', 'rechazada'] },
        $expr: {
          $and: [
            { $eq: [{ $dateToString: { format: '%Y-%m-%d', date: '$fecha', timezone: 'America/Bogota' } }, fecha] },
            ...overlapExpr,
          ],
        },
      }),
    ]);

    const ocupados = new Set([...ocupadosProg, ...ocupadosSem, ...ocupadosRes]);
    const todos = await Salon.find().sort({ nombre_bloque: 1, nombre_salon: 1 }).lean();
    return todos.filter((s) => !ocupados.has(s.nombre_salon));
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

  _fechaHoraFinReserva(reserva) {
    if (!reserva?.fecha || !reserva?.hora_fin) return null;

    const fecha = new Date(reserva.fecha);
    if (Number.isNaN(fecha.getTime())) return null;

    const yyyy = String(fecha.getUTCFullYear());
    const mm = String(fecha.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(fecha.getUTCDate()).padStart(2, '0');
    const fechaHora = new Date(`${yyyy}-${mm}-${dd}T${reserva.hora_fin}:00`);

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
