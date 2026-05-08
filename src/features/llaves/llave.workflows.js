'use strict';

const ApiError = require('../../shared/errors/api.error');
const {
  calcularTiempoRetraso,
  esReclamoAnticipado,
} = require('../../shared/utils/date.helper');
const {
  normalizarDocumento,
  encontrarClaseActual,
  construirResultadoError,
  construirResultadoSinClase,
  construirResultadoAnticipado,
  construirResultadoPrestamo,
  construirResultadoDevolucion,
  construirRegistroEntregaManual,
} = require('./llave.domain');

/**
 * Crea los workflows de gestión de llaves inyectando dependencias.
 * @param {Object} deps - Repositorios y helpers inyectados
 * @returns {{ procesarLecturaNFC, confirmarPrestamoAnticipado, registrarEntrega, registrarDevolucion }}
 */
function createLlaveWorkflows({
  buscarPersonaPorCarnet,
  resolverContextoNFC,
  buscarClaseParaConfirmacion,
  findPendienteByDocumento,
  findReservaPendienteNFCByDocumento,
  findReservaById,
  marcarReservaCheckinNFC,
  findDocenteByDocumento,
  createRegistro,
  normalizarUbicacionPrestamo,
  normalizarUbicacionDevolucion,
  persistirPrestamo,
  persistirDevolucion,
  validarEntregaManual,
  normalizarOrigenRegistro,
}) {
  function construirClaseDesdeReserva(reserva) {
    return {
      aula: reserva.nombre_salon,
      horario: `${reserva.hora_inicio} A ${reserva.hora_fin}`,
      materia: reserva.motivo || 'Reserva de salón',
      facultad: 'Reserva',
      dia: reserva.nombre_bloque || '',
    };
  }

  function resolverEstadoCheckinReserva({ anticipado, tiempoRetraso }) {
    if (anticipado) return 'nfc_anticipado';
    if (tiempoRetraso) return 'nfc_retraso';
    return 'nfc_en_tiempo';
  }

  /** Procesa la devolución de una llave a partir del contexto NFC. */
  async function resolverResultadoDevolucion({ contexto, persona, documento, ubicacion }) {
    try {
      const ubicacionDevolucion = await normalizarUbicacionDevolucion(ubicacion);
      const result = await persistirDevolucion(contexto.prestamoActivo, {
        canal: 'carnet',
        quien: contexto.rol,
        documento,
        nombre: persona.nombre,
        ubicacion: ubicacionDevolucion,
      });

      return construirResultadoDevolucion({
        contexto,
        persona,
        result,
        ubicacion: ubicacionDevolucion,
      });
    } catch (err) {
      return construirResultadoError({ contexto, persona, mensaje: err.message });
    }
  }

  /** Resuelve el préstamo de llave: busca clase actual, valida anticipación y persiste. */
  async function resolverResultadoPrestamo({ contexto, persona, documento, ubicacion }) {
    let ubicacionPrestamo;
    try {
      ubicacionPrestamo = await normalizarUbicacionPrestamo(ubicacion);
    } catch (err) {
      return construirResultadoError({ contexto, persona, mensaje: err.message });
    }

    const ahora = new Date();
    const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes();
    const claseTarget = encontrarClaseActual(contexto.clasesDisponibles, minutosAhora);
    const reservaPendiente = await findReservaPendienteNFCByDocumento(documento, ahora);

    if (!claseTarget && !reservaPendiente) {
      return construirResultadoSinClase({
        contexto,
        persona,
        mensaje: contexto.mensajeSinClase || 'No hay clases o reservas disponibles en el horario actual o próximo',
      });
    }

    // Regla de prioridad solicitada: si hay clase y reserva al tiempo, primero se procesa clase.
    if (!claseTarget && reservaPendiente) {
      const claseReserva = construirClaseDesdeReserva(reservaPendiente);
      const anticipado = esReclamoAnticipado(claseReserva.horario, ahora);
      const tiempoRetraso = calcularTiempoRetraso(claseReserva.horario, ahora);
      const seReclamoATiempo = !tiempoRetraso;

      if (anticipado) {
        return {
          ...construirResultadoAnticipado({ contexto, persona, clase: claseReserva }),
          reserva: { id: String(reservaPendiente._id) },
        };
      }

      const registro = await persistirPrestamo({
        docente: {
          numero_documento: reservaPendiente.solicitante_documento,
          nombre: reservaPendiente.solicitante_nombre,
        },
        clase: claseReserva,
        seReclamoATiempo,
        tiempoRetraso,
        reclamaInfo: {
          quien: contexto.rol,
          documento,
          nombre: persona.nombre,
        },
        tipoEntrega: 'carnet',
        ubicacionPrestamo,
        origenRegistro: 'individual',
      });

      await marcarReservaCheckinNFC({
        reservaId: reservaPendiente._id,
        llavePrestamoId: registro._id,
        checkinEstado: resolverEstadoCheckinReserva({ anticipado: false, tiempoRetraso }),
        now: ahora,
      });

      return {
        ...construirResultadoPrestamo({
          contexto,
          persona,
          clase: claseReserva,
          registro,
          ubicacion: ubicacionPrestamo,
          seReclamoATiempo,
          tiempoRetraso,
        }),
        reserva: { id: String(reservaPendiente._id) },
      };
    }

    const anticipado = esReclamoAnticipado(claseTarget.horario, ahora);
    const tiempoRetraso = calcularTiempoRetraso(claseTarget.horario, ahora);
    const seReclamoATiempo = !tiempoRetraso;

    if (anticipado) {
      return construirResultadoAnticipado({ contexto, persona, clase: claseTarget });
    }

    const registro = await persistirPrestamo({
      docente: contexto.docente,
      clase: claseTarget,
      seReclamoATiempo,
      tiempoRetraso,
      reclamaInfo: {
        quien: contexto.rol,
        documento,
        nombre: persona.nombre,
      },
      tipoEntrega: 'carnet',
      ubicacionPrestamo,
      origenRegistro: claseTarget._origen === 'reserva_semestral' ? 'reserva_semestral' : 'programacion',
    });

    return construirResultadoPrestamo({
      contexto,
      persona,
      clase: claseTarget,
      registro,
      ubicacion: ubicacionPrestamo,
      seReclamoATiempo,
      tiempoRetraso,
    });
  }

  /**
   * Punto de entrada principal: procesa una lectura NFC y decide si es préstamo o devolución.
   * @param {string} idCarnet - ID del carnet leído
   * @param {string} ubicacion - Ubicación del lector NFC
   * @returns {Promise<Object>} Resultado con tipo (prestamo|devolucion|error|sin_clase|anticipado)
   */
  async function procesarLecturaNFC(idCarnet, ubicacion) {
    const persona = await buscarPersonaPorCarnet(idCarnet);
    if (!persona) {
      return { tipo: 'error', mensaje: 'Persona no encontrada para este carnet' };
    }

    const documento = normalizarDocumento(persona.numero_documento);
    const contexto = await resolverContextoNFC(persona, documento);

    if (contexto.prestamoActivo) {
      return resolverResultadoDevolucion({ contexto, persona, documento, ubicacion });
    }

    return resolverResultadoPrestamo({ contexto, persona, documento, ubicacion });
  }

  /** Confirma un préstamo que fue marcado como anticipado por el usuario. */
  async function confirmarPrestamoAnticipado({
    id_carnet,
    horario,
    aula,
    reserva_id,
    rol,
    documento_persona,
    nombre_persona,
    ubicacion,
  }) {
    const ubicacionPrestamo = await normalizarUbicacionPrestamo(ubicacion);
    const persona = await buscarPersonaPorCarnet(id_carnet);
    if (!persona) {
      throw ApiError.notFound('Persona no encontrada');
    }

    let clase;
    let docenteDoc;

    if (reserva_id) {
      const reserva = await findReservaById(reserva_id);
      if (!reserva) {
        throw ApiError.notFound('Reserva no encontrada para confirmar préstamo anticipado');
      }
      if (reserva.entregar_llave !== false) {
        throw ApiError.badRequest('La reserva seleccionada no requiere reclamación NFC');
      }
      if (reserva.llave_entregada) {
        throw ApiError.conflict('La llave de esta reserva ya fue entregada');
      }

      clase = construirClaseDesdeReserva(reserva);
      docenteDoc = normalizarDocumento(reserva.solicitante_documento);
    } else {
      const match = await buscarClaseParaConfirmacion({
        persona,
        aula,
        horario,
        rol,
      });
      clase = match.clase;
      docenteDoc = match.docenteDoc;
    }

    if (!clase) {
      throw ApiError.notFound('Clase no encontrada en la programación');
    }

    const existing = await findPendienteByDocumento(docenteDoc);
    if (existing) {
      throw ApiError.conflict('Ya hay una llave prestada para este docente');
    }

    const docente = await findDocenteByDocumento(docenteDoc);
    const registro = await persistirPrestamo({
      docente: docente || persona,
      clase,
      seReclamoATiempo: true,
      tiempoRetraso: '',
      reclamaInfo: {
        quien: rol || 'docente',
        documento: documento_persona || docenteDoc,
        nombre: nombre_persona || persona.nombre,
      },
      tipoEntrega: 'carnet',
      ubicacionPrestamo,
      origenRegistro: reserva_id ? 'individual' : (clase._origen || 'programacion'),
    });

    if (reserva_id) {
      await marcarReservaCheckinNFC({
        reservaId: reserva_id,
        llavePrestamoId: registro._id,
        checkinEstado: 'nfc_anticipado',
        now: new Date(),
      });
    }

    return {
      ok: true,
      mensaje: `Llave entregada a ${(docente || persona).nombre}`,
      registro,
      docente: docente || persona,
    };
  }

  /** Registra una entrega manual de llave (sin NFC). */
  async function registrarEntrega(infoClase, formatRegistro) {
    const ubicacionPrestamo = await normalizarUbicacionPrestamo(infoClase.ubicacion);
    const origenRegistro = normalizarOrigenRegistro(infoClase.origen);
    validarEntregaManual(infoClase);

    const documento = normalizarDocumento(infoClase.nroidenti);
    const existing = await findPendienteByDocumento(documento);
    if (existing) {
      throw ApiError.conflict('El docente ya tiene una llave prestada');
    }

    const registro = construirRegistroEntregaManual({
      infoClase,
      documento,
      ubicacionPrestamo,
      origenRegistro,
    });

    const created = await createRegistro(registro);
    return {
      ok: true,
      mensaje: `Llave entregada a ${infoClase.profesor}`,
      registro: formatRegistro(created),
    };
  }

  /** Registra una devolución manual de llave (sin NFC). */
  async function registrarDevolucion(documento, ubicacion) {
    const doc = normalizarDocumento(documento);
    const registro = await findPendienteByDocumento(doc);
    if (!registro) {
      throw ApiError.notFound('No se encontró llave en préstamo para este docente');
    }

    const ubicacionDevolucion = await normalizarUbicacionDevolucion(ubicacion);
    const result = await persistirDevolucion(registro, {
      canal: 'manual',
      ubicacion: ubicacionDevolucion,
    });
    return { ok: true, ...result };
  }

  return {
    procesarLecturaNFC,
    confirmarPrestamoAnticipado,
    registrarEntrega,
    registrarDevolucion,
  };
}

module.exports = {
  createLlaveWorkflows,
};
