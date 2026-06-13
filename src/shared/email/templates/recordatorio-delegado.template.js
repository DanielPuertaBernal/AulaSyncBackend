'use strict';

function recordatorioDelegadoTemplate({
  nombreReclama,
  nombreDocente,
  salon,
  fechaPrestamo,
  tiempoTranscurrido,
  numeroRecordatorio,
  tiempoLimiteMinutos,
  horario = '',
  materia = '',
}) {
  const esUrgente = numeroRecordatorio >= 3;
  const headerColor = esUrgente ? '#dc2626' : '#f59e0b';
  const tiempoLimite = tiempoLimiteMinutos >= 60
    ? `${Math.floor(tiempoLimiteMinutos / 60)}h ${tiempoLimiteMinutos % 60 > 0 ? `${tiempoLimiteMinutos % 60}min` : ''}`
    : `${tiempoLimiteMinutos} min`;

  const tituloNotif = numeroRecordatorio === 0
    ? 'Llave prestada no devuelta — Actuación en representación'
    : `Recordatorio #${numeroRecordatorio} — Llave recibida en representación docente`;

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e4e4e7;">
          <tr>
            <td style="background-color:${headerColor};padding:24px 32px;">
              <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">AulaSync</h1>
              <p style="margin:4px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">Sistema de Control de Llaves</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h2 style="margin:0 0 16px;color:#18181b;font-size:18px;font-weight:600;">
                ${tituloNotif}
              </h2>
              <p style="margin:0 0 16px;color:#3f3f46;font-size:14px;line-height:1.6;">
                Estimado/a <strong>${nombreReclama}</strong>,
              </p>
              <p style="margin:0 0 16px;color:#3f3f46;font-size:14px;line-height:1.6;">
                Usted recibió la llave del salón <strong>${salon}</strong> el día
                <strong>${fechaPrestamo}</strong> en representación del docente
                <strong>${nombreDocente}</strong>.
              </p>
              <p style="margin:0 0 16px;color:#3f3f46;font-size:14px;line-height:1.6;">
                Han transcurrido <strong>${tiempoTranscurrido}</strong> desde la entrega de la llave
                y esta aún no ha sido devuelta, superando el tiempo máximo de <strong>${tiempoLimite}</strong>.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;background-color:${esUrgente ? '#fef2f2' : '#fffbeb'};border-radius:6px;border:1px solid ${esUrgente ? '#fecaca' : '#fde68a'};">
                <tr>
                  <td style="padding:16px;">
                    <p style="margin:0 0 8px;color:${esUrgente ? '#dc2626' : '#d97706'};font-size:13px;font-weight:600;">Datos del préstamo:</p>
                    <p style="margin:0;color:#1e3a5f;font-size:13px;line-height:1.8;">
                      ${materia ? `<strong>Clase/Asignatura:</strong> ${materia}<br/>` : ''}
                      <strong>Salón:</strong> ${salon}<br/>
                      ${horario ? `<strong>Franja horaria:</strong> ${horario}<br/>` : ''}
                      <strong>Docente titular:</strong> ${nombreDocente}<br/>
                      <strong>Fecha de préstamo:</strong> ${fechaPrestamo}<br/>
                      <strong>Tiempo transcurrido:</strong> ${tiempoTranscurrido}
                    </p>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;color:#3f3f46;font-size:14px;line-height:1.6;">
                Le solicitamos proceder con la devolución de la llave a la mayor brevedad posible.
                Si ya la devolvió, por favor haga caso omiso de este mensaje.
              </p>
              <p style="margin:24px 0 0;color:#3f3f46;font-size:14px;line-height:1.6;">
                Cordialmente,<br/>
                <strong>Equipo AulaSync</strong>
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#fafafa;padding:16px 32px;border-top:1px solid #e4e4e7;">
              <p style="margin:0;color:#a1a1aa;font-size:11px;text-align:center;">
                Este es un mensaje automático generado por el sistema AulaSync.
                Por favor no responda a este correo.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

module.exports = { recordatorioDelegadoTemplate };
