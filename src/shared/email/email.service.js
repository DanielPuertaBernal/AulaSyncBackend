'use strict';
const { Resend } = require('resend');
const { createLogger } = require('../utils/logger');
const log = createLogger('Email');

const EMAIL_FROM = process.env.EMAIL_FROM;

let _resend = null;
function getResend() {
  if (!_resend) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY no configurada. Agregue la variable de entorno.');
    }
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

async function sendEmail({ to, subject, html }) {
  const { data, error } = await getResend().emails.send({
    from: EMAIL_FROM,
    to,
    subject,
    html,
  });

  if (error) {
    log.error('Error enviando correo', error);
    throw new Error(error.message || 'Error al enviar correo');
  }

  return data;
}

async function sendBulkEmails(emails) {
  const results = [];

  for (const email of emails) {
    try {
      const data = await sendEmail(email);
      results.push({ to: email.to, estado: 'enviado', id: data?.id });
    } catch (err) {
      log.error(`Fallo envío a ${email.to}`, err);
      results.push({ to: email.to, estado: 'fallido', error: err.message });
    }
  }

  return results;
}

module.exports = { sendEmail, sendBulkEmails };
