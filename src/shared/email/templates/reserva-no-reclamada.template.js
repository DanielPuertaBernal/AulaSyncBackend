'use strict';

function reservaNoReclamadaTemplate({ nombreSolicitante, salon, fecha, horaInicio, horaFin }) {
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
            <td style="background-color:#f59e0b;padding:24px 32px;">
              <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">AulaSync</h1>
              <p style="margin:4px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">Sistema de Reserva de Salones</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h2 style="margin:0 0 16px;color:#18181b;font-size:18px;font-weight:600;">
                Reserva cerrada — Llave no reclamada
              </h2>
              <p style="margin:0 0 16px;color:#3f3f46;font-size:14px;line-height:1.6;">
                Estimado/a <strong>${nombreSolicitante}</strong>,
              </p>
              <p style="margin:0 0 16px;color:#3f3f46;font-size:14px;line-height:1.6;">
                Su reserva para el salón <strong>${salon}</strong> el día <strong>${fecha}</strong>
                de <strong>${horaInicio}</strong> a <strong>${horaFin}</strong> ha finalizado,
                pero no se registró la entrega de la llave a través del sistema NFC.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;background-color:#fffbeb;border-radius:6px;border:1px solid #fde68a;">
                <tr>
                  <td style="padding:16px;">
                    <p style="margin:0 0 8px;color:#d97706;font-size:13px;font-weight:600;">Datos de la reserva:</p>
                    <p style="margin:0;color:#1e3a5f;font-size:13px;line-height:1.8;">
                      <strong>Salón:</strong> ${salon}<br/>
                      <strong>Fecha:</strong> ${fecha}<br/>
                      <strong>Horario:</strong> ${horaInicio} – ${horaFin}
                    </p>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;color:#3f3f46;font-size:14px;line-height:1.6;">
                Si ya devolvió la llave, haga caso omiso de este mensaje.
                De lo contrario, le solicitamos entregar la llave a la brevedad posible.
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

module.exports = { reservaNoReclamadaTemplate };
