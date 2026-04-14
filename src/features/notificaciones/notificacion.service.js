'use strict';
const notificacionRepository = require('./notificacion.repository');
const comunidadRepository = require('../comunidad/comunidad.repository');
const { sendBulkEmails } = require('../../shared/email/email.service');
const {
  devolucionLlaveTemplate,
  mensajePersonalizadoTemplate,
} = require('../../shared/email/templates/devolucion-llave.template');

const ASUNTO_PREDETERMINADO = 'Recordatorio de devolución de llave - AulaSync';

function calcularTiempoTranscurrido(fechaEntrega) {
  const ahora = new Date();
  const entrega = new Date(fechaEntrega);
  const diffMs = ahora - entrega;
  const horas = Math.floor(diffMs / (1000 * 60 * 60));
  const minutos = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (horas >= 24) {
    const dias = Math.floor(horas / 24);
    const horasRestantes = horas % 24;
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

    return { enviados, fallidos, total: resultados.length, detalle: resultados };
  }

  async obtenerHistorial(filters, pagination) {
    return notificacionRepository.findHistorial(filters, pagination);
  }
}

module.exports = new NotificacionService();
