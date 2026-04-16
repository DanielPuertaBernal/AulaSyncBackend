'use strict';
const nodemailer = require('nodemailer');
const { createLogger } = require('../utils/logger');
const log = createLogger('Email');

let _transporter = null;
function getTransporter() {
  if (!_transporter) {
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASS) {
      throw new Error('GMAIL_USER y GMAIL_APP_PASS no configuradas. Agregue las variables de entorno.');
    }
    _transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASS,
      },
    });
  }
  return _transporter;
}

async function sendEmail({ to, subject, html }) {
  const info = await getTransporter().sendMail({
    from: `"AulaSync" <${process.env.GMAIL_USER}>`,
    to,
    subject,
    html,
  });

  log.info(`Correo enviado a ${to} — messageId: ${info.messageId}`);
  return { id: info.messageId };
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
