'use strict';
const notificacionRepository = require('./notificacion.repository');
const configuracionService = require('../configuracion/configuracion.service');
const llaveRepository = require('../llaves/llave.repository');
const comunidadRepository = require('../comunidad/comunidad.repository');
const salonRepository = require('../salones/salon.repository');
const novedadRepository = require('../novedades/novedad.repository');
const novedadService = require('../novedades/novedad.service');
const { sendEmail, sendBulkEmails } = require('../../shared/email/email.service');
const {
  devolucionLlaveTemplate,
  mensajePersonalizadoTemplate,
} = require('../../shared/email/templates/devolucion-llave.template');
const {
  recordatorioDevolucionTemplate,
} = require('../../shared/email/templates/recordatorio-devolucion.template');
const {
  reservaNoReclamadaTemplate,
} = require('../../shared/email/templates/reserva-no-reclamada.template');
const {
  recordatorioDelegadoTemplate,
} = require('../../shared/email/templates/recordatorio-delegado.template');
const { createLogger } = require('../../shared/utils/logger');
const { formatMinutos } = require('../../shared/utils/date.helper');

const logger = createLogger('Notificaciones');

const ASUNTO_PREDETERMINADO = 'Recordatorio de devolución de llave - AulaSync';
const MS_POR_HORA = 1000 * 60 * 60;
const MS_POR_MINUTO = 1000 * 60;
const HORAS_POR_DIA = 24;

function calcularTiempoTranscurrido(fechaEntrega) {
  const diffMs = new Date() - new Date(fechaEntrega);
  return formatMinutos(Math.floor(diffMs / MS_POR_MINUTO));
}

function formatearFecha(fecha) {
  const d = new Date(fecha);
  return d.toLocaleDateString('es-CO', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

class NotificacionService {
  async enviarNotificacionesDevolucion({ destinatarios, tipo_mensaje, mensaje_personalizado, asunto }, enviadoPor) {
    const asuntoFinal = asunto || ASUNTO_PREDETERMINADO;

    const emails = destinatarios.map((dest) => {
      const tiempoTranscurrido = dest.tiempo_transcurrido || calcularTiempoTranscurrido(dest.fecha_prestamo);
      const fechaFormateada = formatearFecha(dest.fecha_prestamo);

      const htmlContent =
        tipo_mensaje === 'personalizado'
          ? mensajePersonalizadoTemplate({
              nombreDocente: dest.nombre,
              salon: dest.salon,
              fechaPrestamo: fechaFormateada,
              tiempoTranscurrido,
              mensaje: mensaje_personalizado,
            })
          : devolucionLlaveTemplate({
              nombreDocente: dest.nombre,
              salon: dest.salon,
              fechaPrestamo: fechaFormateada,
              tiempoTranscurrido,
            });

      return {
        to: dest.correo,
        subject: asuntoFinal,
        html: htmlContent,
        _meta: dest,
      };
    });

    const resultados = await sendBulkEmails(emails);

    const registros = resultados.map((r, i) => ({
      destinatario_nombre: destinatarios[i].nombre,
      destinatario_documento: destinatarios[i].documento,
      destinatario_correo: destinatarios[i].correo,
      tipo_mensaje,
      asunto: asuntoFinal,
      mensaje: tipo_mensaje === 'personalizado' ? mensaje_personalizado : '',
      llave_id: destinatarios[i].llave_id || null,
      salon: destinatarios[i].salon || '',
      estado_envio: r.estado,
      error_envio: r.error || '',
      enviado_por: enviadoPor,
      tipo_notificacion: 'manual',
    }));

    await notificacionRepository.createMany(registros);

    const enviados = resultados.filter((r) => r.estado === 'enviado').length;
    const fallidos = resultados.filter((r) => r.estado === 'fallido').length;

    logger.info('Notificaciones enviadas', { enviados, fallidos, total: resultados.length, tipo_mensaje });

    return { enviados, fallidos, total: resultados.length, detalle: resultados };
  }

  async obtenerHistorial(filters, pagination) {
    return notificacionRepository.findHistorial(filters, pagination);
  }

  async obtenerEstadisticas() {
    return notificacionRepository.estadisticas();
  }

  async obtenerContadoresRecordatorios() {
    return notificacionRepository.contarRecordatoriosPorLlaves();
  }

  async reenviar(notificacionId) {
    const notif = await notificacionRepository.findById(notificacionId);
    if (!notif) {
      const ApiError = require('../../shared/errors/api.error');
      throw ApiError.notFound('Notificación no encontrada');
    }
    if (notif.estado_envio === 'enviado') {
      const ApiError = require('../../shared/errors/api.error');
      throw ApiError.badRequest('La notificación ya fue enviada exitosamente');
    }

    try {
      const fechaRef = notif.fecha_hora_prestamo || notif.fecha_envio;
      let htmlContent;

      if (notif.tipo_notificacion === 'reserva_no_reclamada') {
        htmlContent = reservaNoReclamadaTemplate({
          nombreSolicitante: notif.destinatario_nombre,
          salon: notif.salon,
          fecha: notif.reserva_fecha || formatearFecha(fechaRef),
          horaInicio: notif.reserva_hora_inicio || '',
          horaFin: notif.reserva_hora_fin || '',
        });
      } else {
        htmlContent = devolucionLlaveTemplate({
          nombreDocente: notif.destinatario_nombre,
          salon: notif.salon,
          fechaPrestamo: formatearFecha(fechaRef),
          tiempoTranscurrido: calcularTiempoTranscurrido(fechaRef),
        });
      }

      await sendEmail({
        to: notif.destinatario_correo,
        subject: notif.asunto,
        html: htmlContent,
      });

      await notificacionRepository.updateById(notificacionId, {
        estado_envio: 'enviado',
        error_envio: '',
        intentos_envio: (notif.intentos_envio || 0) + 1,
      });

      return { ok: true, estado: 'enviado' };
    } catch (err) {
      await notificacionRepository.updateById(notificacionId, {
        error_envio: err.message,
        intentos_envio: (notif.intentos_envio || 0) + 1,
      });
      return { ok: false, estado: 'fallido', error: err.message };
    }
  }

  async descartar(id) {
    const notif = await notificacionRepository.findById(id);
    if (!notif) throw Object.assign(new Error('Notificación no encontrada'), { status: 404 });
    return notificacionRepository.updateById(id, { estado_envio: 'descartado' });
  }

  async descartarPorReserva(reservaId) {
    const notif = await notificacionRepository.findPendienteByReserva(reservaId);
    if (!notif) throw Object.assign(new Error('No hay notificación pendiente para esta reserva'), { status: 404 });
    return notificacionRepository.updateById(notif._id, { estado_envio: 'descartado' });
  }

  /**
   * Verifica préstamos vencidos y encola notificaciones automáticas.
   * Usado por el scheduler.
   */
  async verificarYEncolarNotificaciones() {
    const pendientes = await llaveRepository.findPendientes();
    if (!pendientes.length) return { procesados: 0, encolados: 0 };

    const ahora = new Date();
    const registrosACrear = [];

    for (const prestamo of pendientes) {
      try {
        const salon = await salonRepository.findByNombre(prestamo.aula);
        const nombreBloque = salon?.nombre_bloque || this._extraerBloque(prestamo.aula);
        if (!salon) {
          logger.warn('Salon no encontrado en BD para lookup de configuracion, usando extraccion regex', { aula: prestamo.aula });
        }
        const config = await configuracionService.obtenerPorBloque(nombreBloque);

        if (!config.notificaciones_activas) continue;

        const partes = (prestamo.horario || '').toUpperCase().split(' A ');
        const horaFinStr = partes.length >= 2 ? partes[1].trim() : null;
        let finClase;
        if (horaFinStr) {
          const [h, m] = horaFinStr.split(':').map(Number);
          if (!Number.isNaN(h) && !Number.isNaN(m)) {
            // Construir finClase en timezone America/Bogota (UTC-5, sin DST)
            const fechaBase = new Date(prestamo.fecha_hora_entrega);
            const fechaBogota = fechaBase.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
            finClase = new Date(`${fechaBogota}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00-05:00`);
          }
        }
        if (!finClase) finClase = new Date(prestamo.fecha_hora_entrega);

        const minutosTranscurridos = (ahora - finClase) / (1000 * 60);
        if (minutosTranscurridos < 0) continue;
        if (minutosTranscurridos < config.tiempo_maximo_prestamo_minutos) continue;

        // Préstamo ya en estado crítico → solo garantizar que exista la novedad
        if (prestamo.estado === 'demora_entrega') {
          const novedadExistente = await novedadRepository.findByPrestamoRef(prestamo._id);
          if (!novedadExistente) {
            await novedadService.registrar(this._construirNovedadDemora(prestamo, config, minutosTranscurridos));
          }
          continue;
        }

        // Transición: en_prestamo → en_mora
        if (prestamo.estado === 'en_prestamo') {
          await llaveRepository.update(prestamo._id, { estado: 'en_mora' });
        }

        // Buscar correo del docente en comunidad
        const persona = await comunidadRepository.findByDocumento(prestamo.numero_documento);
        if (!persona?.correo) continue;

        const notifEnviadas = await notificacionRepository.countByPrestamoAndTipo(
          prestamo._id,
          'recordatorio'
        );
        const tieneVencimientoInicial = await notificacionRepository.countByPrestamoAndTipo(
          prestamo._id,
          'vencimiento_inicial'
        );

        // Transición: en_mora → demora_entrega (todos los recordatorios enviados)
        if (notifEnviadas >= config.max_recordatorios) {
          await llaveRepository.update(prestamo._id, { estado: 'demora_entrega' });
          const novedadExistente = await novedadRepository.findByPrestamoRef(prestamo._id);
          if (!novedadExistente) {
            await novedadService.registrar(this._construirNovedadDemora(prestamo, config, minutosTranscurridos));
          }
          continue;
        }

        if (!tieneVencimientoInicial) {
          registrosACrear.push(
            this._construirNotificacionAutomatica(prestamo, persona, config, 'vencimiento_inicial', 0, minutosTranscurridos)
          );
        } else if (notifEnviadas < config.max_recordatorios) {
          const ultimaNotif = await notificacionRepository.findLastByPrestamo(prestamo._id);
          const minutosDesdeUltima = ultimaNotif
            ? (ahora - new Date(ultimaNotif.fecha_envio)) / (1000 * 60)
            : config.intervalo_recordatorio_minutos + 1;

          if (minutosDesdeUltima >= config.intervalo_recordatorio_minutos) {
            registrosACrear.push(
              this._construirNotificacionAutomatica(
                prestamo, persona, config, 'recordatorio',
                notifEnviadas + 1, minutosTranscurridos
              )
            );
          }
        }

        // Si la llave fue recibida por otra persona, notificarla también
        if (prestamo.quien_reclama === 'otra_persona' && prestamo.numero_documento_reclama) {
          const personaReclama = await comunidadRepository.findByDocumento(prestamo.numero_documento_reclama);
          if (personaReclama?.correo) {
            const notifDelegadoEnviadas = await notificacionRepository.countByPrestamoAndTipo(prestamo._id, 'delegado_recordatorio');
            const tieneDelegadoVencimiento = await notificacionRepository.countByPrestamoAndTipo(prestamo._id, 'delegado_vencimiento');

            if (!tieneDelegadoVencimiento) {
              registrosACrear.push(
                this._construirNotificacionDelegado(prestamo, persona, personaReclama, config, 'delegado_vencimiento', 0, minutosTranscurridos)
              );
            } else if (notifDelegadoEnviadas < config.max_recordatorios) {
              const ultimaNotifDelegado = await notificacionRepository.findLastByPrestamoAndTipo(prestamo._id, 'delegado_recordatorio');
              const minutosDesdeUltimaDelegado = ultimaNotifDelegado
                ? (ahora - new Date(ultimaNotifDelegado.fecha_envio)) / (1000 * 60)
                : config.intervalo_recordatorio_minutos + 1;

              if (minutosDesdeUltimaDelegado >= config.intervalo_recordatorio_minutos) {
                registrosACrear.push(
                  this._construirNotificacionDelegado(
                    prestamo, persona, personaReclama, config, 'delegado_recordatorio',
                    notifDelegadoEnviadas + 1, minutosTranscurridos
                  )
                );
              }
            }
          }
        }
      } catch (err) {
        logger.error('Error verificando préstamo para notificaciones', {
          prestamoId: prestamo._id,
          error: err.message,
        });
      }
    }

    if (registrosACrear.length) {
      await notificacionRepository.createMany(registrosACrear);
    }

    logger.info('Verificación de notificaciones completada', {
      procesados: pendientes.length,
      encolados: registrosACrear.length,
    });

    return { procesados: pendientes.length, encolados: registrosACrear.length };
  }

  /**
   * Procesa notificaciones pendientes que ya están listas para enviarse
   * (estado_envio='pendiente' y sin proximo_reintento futuro).
   * Respeta el backoff exponencial: no reintenta antes de proximo_reintento.
   */
  async procesarColaNotificaciones() {
    const items = await notificacionRepository.findPendientesEnvio(50);
    if (!items.length) return { enviados: 0, fallidos: 0 };

    let enviados = 0;
    let fallidos = 0;

    for (const notif of items) {
      try {
        const fechaRef = notif.fecha_hora_prestamo || notif.fecha_envio;
        const tiempoTranscurrido = calcularTiempoTranscurrido(fechaRef);
        const fechaFormateada = formatearFecha(fechaRef);
        let htmlContent;

        if (notif.tipo_notificacion === 'reserva_no_reclamada') {
          htmlContent = reservaNoReclamadaTemplate({
            nombreSolicitante: notif.destinatario_nombre,
            salon: notif.salon,
            fecha: notif.reserva_fecha || fechaFormateada,
            horaInicio: notif.reserva_hora_inicio || '',
            horaFin: notif.reserva_hora_fin || '',
          });
        } else if (notif.tipo_notificacion === 'delegado_recordatorio' || notif.tipo_notificacion === 'delegado_vencimiento') {
          const salonDoc = await salonRepository.findByNombre(notif.salon || '');
          const nombreBloqueNotif = salonDoc?.nombre_bloque || this._extraerBloque(notif.salon || '');
          const configBloque = await configuracionService.obtenerPorBloque(nombreBloqueNotif);
          htmlContent = recordatorioDelegadoTemplate({
            nombreReclama: notif.destinatario_nombre,
            nombreDocente: notif.nombre_docente_representado || '',
            salon: notif.salon,
            fechaPrestamo: fechaFormateada,
            tiempoTranscurrido,
            numeroRecordatorio: notif.numero_recordatorio || 1,
            tiempoLimiteMinutos: configBloque.tiempo_maximo_prestamo_minutos,
            horario: notif.horario_clase || '',
            materia: notif.materia || '',
          });
        } else if (notif.tipo_notificacion === 'recordatorio' || notif.tipo_notificacion === 'vencimiento_inicial') {
          const salonDoc = await salonRepository.findByNombre(notif.salon || '');
          const nombreBloqueNotif = salonDoc?.nombre_bloque || this._extraerBloque(notif.salon || '');
          const configBloque = await configuracionService.obtenerPorBloque(nombreBloqueNotif);
          htmlContent = recordatorioDevolucionTemplate({
            nombreDocente: notif.destinatario_nombre,
            salon: notif.salon,
            fechaPrestamo: fechaFormateada,
            tiempoTranscurrido,
            numeroRecordatorio: notif.numero_recordatorio || 1,
            tiempoLimiteMinutos: configBloque.tiempo_maximo_prestamo_minutos,
            horario: notif.horario_clase || '',
            materia: notif.materia || '',
          });
        } else {
          htmlContent = devolucionLlaveTemplate({
            nombreDocente: notif.destinatario_nombre,
            salon: notif.salon,
            fechaPrestamo: fechaFormateada,
            tiempoTranscurrido,
          });
        }

        await sendEmail({
          to: notif.destinatario_correo,
          subject: notif.asunto,
          html: htmlContent,
        });

        await notificacionRepository.updateById(notif._id, {
          estado_envio: 'enviado',
          error_envio: '',
          intentos_envio: (notif.intentos_envio || 0) + 1,
        });
        enviados++;
      } catch (err) {
        const intentos = (notif.intentos_envio || 0) + 1;
        const updates = {
          error_envio: err.message,
          intentos_envio: intentos,
        };

        if (intentos >= 3) {
          updates.estado_envio = 'fallido';
        } else {
          // Backoff exponencial: 2^intentos minutos
          updates.proximo_reintento = new Date(Date.now() + Math.pow(2, intentos) * 60 * 1000);
        }

        await notificacionRepository.updateById(notif._id, updates);
        fallidos++;

        logger.error('Fallo envío notificación automática', {
          notifId: notif._id,
          intento: intentos,
          error: err.message,
        });
      }
    }

    logger.info('Cola de notificaciones procesada', { enviados, fallidos });
    return { enviados, fallidos };
  }

  /**
   * Envía notificaciones manuales para un lote de reservas.
   * Busca el correo del solicitante en comunidad y registra el envío.
   */
  async enviarNotificacionManualReservas({ reserva_ids, tipo_mensaje, mensaje_personalizado, asunto }, enviadoPor) {
    const { Reserva } = require('../reservas/reserva.schema');
    const ApiError = require('../../shared/errors/api.error');
    if (!reserva_ids?.length) throw ApiError.badRequest('Debe indicar al menos una reserva');

    const reservas = await Reserva.find({ _id: { $in: reserva_ids } }).lean();
    if (!reservas.length) throw ApiError.notFound('No se encontraron las reservas indicadas');

    const resultados = [];
    for (const reserva of reservas) {
      try {
        const persona = await comunidadRepository.findByDocumento(reserva.solicitante_documento);
        if (!persona?.correo) {
          resultados.push({ reserva_id: reserva._id, estado: 'sin_correo', nombre: reserva.solicitante_nombre });
          continue;
        }

        const fechaStr = new Date(reserva.fecha).toLocaleDateString('es-CO', {
          timeZone: 'America/Bogota', year: 'numeric', month: 'long', day: 'numeric',
        });

        const asuntoFinal = asunto || 'Notificación sobre su reserva — AulaSync';
        const htmlContent = tipo_mensaje === 'personalizado' && mensaje_personalizado
          ? mensajePersonalizadoTemplate({
              nombreDocente: reserva.solicitante_nombre,
              salon: reserva.nombre_salon,
              fechaPrestamo: fechaStr,
              tiempoTranscurrido: '',
              mensaje: mensaje_personalizado,
            })
          : reservaNoReclamadaTemplate({
              nombreSolicitante: reserva.solicitante_nombre,
              salon: reserva.nombre_salon,
              fecha: fechaStr,
              horaInicio: reserva.hora_inicio,
              horaFin: reserva.hora_fin,
            });

        await sendEmail({ to: persona.correo, subject: asuntoFinal, html: htmlContent });

        await notificacionRepository.create({
          destinatario_nombre: reserva.solicitante_nombre,
          destinatario_documento: reserva.solicitante_documento,
          destinatario_correo: persona.correo,
          tipo_mensaje: tipo_mensaje || 'predeterminado',
          asunto: asuntoFinal,
          mensaje: tipo_mensaje === 'personalizado' ? mensaje_personalizado : '',
          reserva_id: reserva._id,
          salon: reserva.nombre_salon,
          tipo_notificacion: 'manual',
          estado_envio: 'enviado',
          enviado_por: enviadoPor,
          fecha_envio: new Date(),
          reserva_fecha: fechaStr,
          reserva_hora_inicio: reserva.hora_inicio,
          reserva_hora_fin: reserva.hora_fin,
        });

        resultados.push({ reserva_id: reserva._id, estado: 'enviado', correo: persona.correo, nombre: reserva.solicitante_nombre });
      } catch (err) {
        logger.error('Fallo envío manual reserva', { reservaId: reserva._id, error: err.message });
        resultados.push({ reserva_id: reserva._id, estado: 'fallido', error: err.message, nombre: reserva.solicitante_nombre });
      }
    }

    const enviados = resultados.filter((r) => r.estado === 'enviado').length;
    const fallidos = resultados.filter((r) => r.estado === 'fallido').length;
    const sinCorreo = resultados.filter((r) => r.estado === 'sin_correo').length;

    logger.info('Notificaciones manuales de reservas enviadas', { enviados, fallidos, sinCorreo, total: reservas.length });
    return { enviados, fallidos, sin_correo: sinCorreo, total: reservas.length, detalle: resultados };
  }

  _construirNotificacionDelegado(prestamo, personaDocente, personaReclama, config, tipo, numero, minutosTranscurridos) {
    return {
      destinatario_nombre: personaReclama.nombre,
      destinatario_documento: prestamo.numero_documento_reclama,
      destinatario_correo: personaReclama.correo,
      tipo_mensaje: 'predeterminado',
      asunto: tipo === 'delegado_vencimiento'
        ? 'Llave prestada no devuelta — Representación docente - AulaSync'
        : `Recordatorio #${numero} — Llave recibida en representación docente - AulaSync`,
      salon: prestamo.aula || '',
      prestamo_llave_id: prestamo._id,
      tipo_notificacion: tipo,
      numero_recordatorio: numero,
      estado_envio: 'pendiente',
      enviado_por: 'sistema',
      fecha_envio: new Date(),
      fecha_hora_prestamo: prestamo.fecha_hora_entrega || null,
      horario_clase: prestamo.horario || '',
      materia: prestamo.materia || '',
      es_delegado: true,
      nombre_docente_representado: personaDocente?.nombre || prestamo.docente || '',
    };
  }

  _construirNovedadDemora(prestamo, config, minutosTranscurridos) {
    return {
      tipo_recurso: 'llave',
      recurso_id: prestamo._id,
      prestamo_ref: prestamo._id,
      reportado_por: prestamo.numero_documento,
      reportado_por_nombre: prestamo.docente || '',
      salon: prestamo.aula || '',
      categoria: 'demora_entrega',
      descripcion: `Llave del sal\u00f3n ${prestamo.aula || 'desconocido'} no devuelta tras ${config.max_recordatorios} recordatorio(s). Docente: ${prestamo.docente || prestamo.numero_documento}. Horario: ${prestamo.horario || 'No registrado'}. Materia: ${prestamo.materia || 'No especificada'}. Tiempo en mora: ${formatMinutos(minutosTranscurridos)}.`,
      estado: 'abierta',
    };
  }

  _extraerBloque(aula) {
    if (!aula) return '';
    // Aula format: "J-101", "M-203", etc. Extract block letter(s) before the dash
    const match = aula.match(/^([A-Za-z]+)/);
    return match ? match[1].toUpperCase() : '';
  }

  _construirNotificacionAutomatica(prestamo, persona, config, tipo, numero, minutosTranscurridos) {
    return {
      destinatario_nombre: prestamo.docente || persona.nombre,
      destinatario_documento: prestamo.numero_documento,
      destinatario_correo: persona.correo,
      tipo_mensaje: 'predeterminado',
      asunto: tipo === 'vencimiento_inicial'
        ? 'Tiempo de préstamo de llave vencido - AulaSync'
        : `Recordatorio #${numero} — Devolución de llave - AulaSync`,
      salon: prestamo.aula || '',
      prestamo_llave_id: prestamo._id,
      tipo_notificacion: tipo,
      numero_recordatorio: numero,
      estado_envio: 'pendiente',
      enviado_por: 'sistema',
      fecha_envio: new Date(),
      fecha_hora_prestamo: prestamo.fecha_hora_entrega || null,
      horario_clase: prestamo.horario || '',
      materia: prestamo.materia || '',
    };
  }
}

module.exports = new NotificacionService();
