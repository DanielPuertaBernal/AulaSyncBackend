'use strict';
const notificacionRepository = require('./notificacion.repository');
const configuracionService = require('../configuracion/configuracion.service');
const llaveRepository = require('../llaves/llave.repository');
const comunidadRepository = require('../comunidad/comunidad.repository');
const { sendEmail, sendBulkEmails } = require('../../shared/email/email.service');
const {
  devolucionLlaveTemplate,
  mensajePersonalizadoTemplate,
} = require('../../shared/email/templates/devolucion-llave.template');
const {
  recordatorioDevolucionTemplate,
} = require('../../shared/email/templates/recordatorio-devolucion.template');
const { createLogger } = require('../../shared/utils/logger');

const logger = createLogger('Notificaciones');

const ASUNTO_PREDETERMINADO = 'Recordatorio de devolución de llave - AulaSync';
const MS_POR_HORA = 1000 * 60 * 60;
const MS_POR_MINUTO = 1000 * 60;
const HORAS_POR_DIA = 24;

function calcularTiempoTranscurrido(fechaEntrega) {
  const ahora = new Date();
  const entrega = new Date(fechaEntrega);
  const diffMs = ahora - entrega;
  const horas = Math.floor(diffMs / MS_POR_HORA);
  const minutos = Math.floor((diffMs % MS_POR_HORA) / MS_POR_MINUTO);

  if (horas >= HORAS_POR_DIA) {
    const dias = Math.floor(horas / HORAS_POR_DIA);
    const horasRestantes = horas % HORAS_POR_DIA;
    return `${dias} día${dias > 1 ? 's' : ''} y ${horasRestantes}h`;
  }
  return `${horas}h ${minutos}min`;
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
      const htmlContent = devolucionLlaveTemplate({
        nombreDocente: notif.destinatario_nombre,
        salon: notif.salon,
        fechaPrestamo: formatearFecha(fechaRef),
        tiempoTranscurrido: calcularTiempoTranscurrido(fechaRef),
      });

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
        const bloque = this._extraerBloque(prestamo.aula);
        const config = await configuracionService.obtenerPorBloque(bloque);

        if (!config.notificaciones_activas) continue;

        const partes = (prestamo.horario || '').toUpperCase().split(' A ');
        const horaFinStr = partes.length >= 2 ? partes[1].trim() : null;
        let finClase;
        if (horaFinStr) {
          const [h, m] = horaFinStr.split(':').map(Number);
          if (!Number.isNaN(h) && !Number.isNaN(m)) {
            finClase = new Date(prestamo.fecha_hora_entrega);
            finClase.setHours(h, m, 0, 0);
          }
        }
        if (!finClase) finClase = new Date(prestamo.fecha_hora_entrega);

        const minutosTranscurridos = (ahora - finClase) / (1000 * 60);
        if (minutosTranscurridos < 0) continue;
        if (minutosTranscurridos <= config.tiempo_maximo_prestamo_minutos) continue;

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

        if (!tieneVencimientoInicial) {
          registrosACrear.push(
            this._construirNotificacionAutomatica(prestamo, persona, config, 'vencimiento_inicial', 0, minutosTranscurridos)
          );
        }

        if (notifEnviadas < config.max_recordatorios) {
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
   * Procesa notificaciones pendientes que aún no se han enviado (estado_envio='pendiente').
   * Envía emails y actualiza estados.
   */
  async procesarColaNotificaciones() {
    const pendientes = await notificacionRepository.findHistorial(
      { estado_envio: 'pendiente' },
      { page: 1, limit: 50 }
    );
    const items = pendientes.data || pendientes;
    if (!items.length) return { enviados: 0, fallidos: 0 };

    let enviados = 0;
    let fallidos = 0;

    for (const notif of items) {
      try {
        const fechaRef = notif.fecha_hora_prestamo || notif.fecha_envio;
        const tiempoTranscurrido = calcularTiempoTranscurrido(fechaRef);
        const fechaFormateada = formatearFecha(fechaRef);
        let htmlContent;

        if (notif.tipo_notificacion === 'recordatorio' || notif.tipo_notificacion === 'vencimiento_inicial') {
          htmlContent = recordatorioDevolucionTemplate({
            nombreDocente: notif.destinatario_nombre,
            salon: notif.salon,
            fechaPrestamo: fechaFormateada,
            tiempoTranscurrido,
            numeroRecordatorio: notif.numero_recordatorio || 1,
            tiempoLimiteMinutos: 120,
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
    };
  }
}

module.exports = new NotificacionService();
