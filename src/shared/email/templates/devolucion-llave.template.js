'use strict';

function devolucionLlaveTemplate({ nombreDocente, salon, fechaPrestamo, tiempoTranscurrido }) {
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
          <!-- Header -->
          <tr>
            <td style="background-color:#1e40af;padding:24px 32px;">
              <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">AulaSync</h1>
              <p style="margin:4px 0 0;color:#bfdbfe;font-size:13px;">Sistema de Control de Llaves</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <h2 style="margin:0 0 16px;color:#18181b;font-size:18px;font-weight:600;">
                Recordatorio de Devolución de Llave
              </h2>
              <p style="margin:0 0 16px;color:#3f3f46;font-size:14px;line-height:1.6;">
                Estimado/a <strong>${nombreDocente}</strong>,
              </p>
              <p style="margin:0 0 16px;color:#3f3f46;font-size:14px;line-height:1.6;">
                Le informamos que actualmente tiene en su poder la llave del salón
                <strong>${salon}</strong>, la cual fue prestada el día
                <strong>${fechaPrestamo}</strong> (hace ${tiempoTranscurrido}).
              </p>
              <p style="margin:0 0 16px;color:#3f3f46;font-size:14px;line-height:1.6;">
                Le solicitamos amablemente realizar la devolución de esta llave a la mayor brevedad posible.
                El cumplimiento oportuno de los tiempos de devolución es fundamental para garantizar
                la disponibilidad de los espacios y facilitar su uso por parte de otros docentes y usuarios
                de la institución.
              </p>
              <!-- Info box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;background-color:#eff6ff;border-radius:6px;border:1px solid #bfdbfe;">
                <tr>
                  <td style="padding:16px;">
                    <p style="margin:0 0 8px;color:#1e40af;font-size:13px;font-weight:600;">Datos del préstamo:</p>
                    <p style="margin:0;color:#1e3a5f;font-size:13px;line-height:1.8;">
                      <strong>Salón:</strong> ${salon}<br/>
                      <strong>Fecha de préstamo:</strong> ${fechaPrestamo}<br/>
                      <strong>Tiempo transcurrido:</strong> ${tiempoTranscurrido}
                    </p>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;color:#3f3f46;font-size:14px;line-height:1.6;">
                Si ya realizó la devolución, le pedimos hacer caso omiso de este mensaje.
              </p>
              <p style="margin:24px 0 0;color:#3f3f46;font-size:14px;line-height:1.6;">
                Cordialmente,<br/>
                <strong>Equipo AulaSync</strong>
              </p>
            </td>
          </tr>
          <!-- Footer -->
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

function mensajePersonalizadoTemplate({ nombreDocente, salon, fechaPrestamo, tiempoTranscurrido, mensaje }) {
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
          <!-- Header -->
          <tr>
            <td style="background-color:#1e40af;padding:24px 32px;">
              <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">AulaSync</h1>
              <p style="margin:4px 0 0;color:#bfdbfe;font-size:13px;">Sistema de Control de Llaves</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;color:#3f3f46;font-size:14px;line-height:1.6;">
                Estimado/a <strong>${nombreDocente}</strong>,
              </p>
              <p style="margin:0 0 16px;color:#3f3f46;font-size:14px;line-height:1.6;white-space:pre-line;">
                ${mensaje}
              </p>
              <!-- Info box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;background-color:#eff6ff;border-radius:6px;border:1px solid #bfdbfe;">
                <tr>
                  <td style="padding:16px;">
                    <p style="margin:0 0 8px;color:#1e40af;font-size:13px;font-weight:600;">Datos del préstamo:</p>
                    <p style="margin:0;color:#1e3a5f;font-size:13px;line-height:1.8;">
                      <strong>Salón:</strong> ${salon}<br/>
                      <strong>Fecha de préstamo:</strong> ${fechaPrestamo}<br/>
                      <strong>Tiempo transcurrido:</strong> ${tiempoTranscurrido}
                    </p>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;color:#3f3f46;font-size:14px;line-height:1.6;">
                Cordialmente,<br/>
                <strong>Equipo AulaSync</strong>
              </p>
            </td>
          </tr>
          <!-- Footer -->
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

module.exports = { devolucionLlaveTemplate, mensajePersonalizadoTemplate };
