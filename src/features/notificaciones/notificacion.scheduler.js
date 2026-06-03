'use strict';
const cron = require('node-cron');
const notificacionService = require('./notificacion.service');
const reservaService = require('../reservas/reserva.service');
const { createLogger } = require('../../shared/utils/logger');

const logger = createLogger('NotificacionScheduler');

let tareaActiva = null;

function iniciar() {
  if (tareaActiva) {
    logger.warn('El scheduler de notificaciones ya está activo');
    return;
  }

  // Ejecutar cada 5 minutos
  tareaActiva = cron.schedule('*/5 * * * *', async () => {
    try {
      logger.info('Iniciando ciclo de notificaciones automáticas');
      await reservaService.sincronizarEstadosVencidos();
      const encolados = await notificacionService.verificarYEncolarNotificaciones();
      const enviados = await notificacionService.procesarColaNotificaciones();
      logger.info('Ciclo de notificaciones completado', { encolados, enviados });
    } catch (err) {
      logger.error('Error en ciclo de notificaciones', { error: err.message });
    }
  });

  logger.info('Scheduler de notificaciones iniciado (cada 5 minutos)');
}

function detener() {
  if (tareaActiva) {
    tareaActiva.stop();
    tareaActiva = null;
    logger.info('Scheduler de notificaciones detenido');
  }
}

module.exports = { iniciar, detener };
