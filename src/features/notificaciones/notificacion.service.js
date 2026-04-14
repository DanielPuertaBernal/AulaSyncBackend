'use strict';
const notificacionRepository = require('./notificacion.repository');
const comunidadRepository = require('../comunidad/comunidad.repository');
const { sendBulkEmails } = require('../../shared/email/email.service');
const {
  devolucionLlaveTemplate,
  mensajePersonalizadoTemplate,
} = require('../../shared/email/templates/devolucion-llave.template');
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

    // Build emails
    const emails = destinatarios.map((dest) => {
      const tiempoTranscurrido = calcularTiempoTranscurrido(dest.fecha_prestamo);
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

    // Send emails
    const resultados = await sendBulkEmails(emails);

    // Persist history
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
}

module.exports = new NotificacionService();
