'use strict';
const monitorRepository = require('./monitor.repository');
const comunidadRepository = require('../comunidad/comunidad.repository');
const programacionRepository = require('../programacion/programacion.repository');
const ApiError = require('../../shared/errors/api.error');
const { createLogger } = require('../../shared/utils/logger');

const logger = createLogger('Monitores');

class MonitorService {
  async listarTodos() {
    return monitorRepository.findAll();
  }

  async listarPorDocente(documentoDocente) {
    return monitorRepository.findByDocente(documentoDocente);
  }

  async obtenerClasesDocente(documentoDocente) {
    return programacionRepository.findByDocumento(documentoDocente);
  }

  async registrar({ numero_documento_docente, numero_documento_monitor, materia, aula, horario, dia }) {
    const docente = await comunidadRepository.findByDocumento(numero_documento_docente);
    if (!docente) throw ApiError.notFound('Docente no encontrado');

    const monitor = await comunidadRepository.findByDocumento(numero_documento_monitor);
    if (!monitor) throw ApiError.notFound('Persona no encontrada en el sistema');

    if (numero_documento_docente === numero_documento_monitor) {
      throw ApiError.badRequest('El docente no puede ser monitor de sí mismo');
    }

    const registro = await monitorRepository.create({
      numero_documento_docente: docente.numero_documento,
      nombre_docente: docente.nombre,
      numero_documento_monitor: monitor.numero_documento,
      nombre_monitor: monitor.nombre,
      id_carnet_monitor: monitor.id_carnet || '',
      facultad_monitor: monitor.facultad || '',
      correo_monitor: monitor.correo || '',
      materia,
      aula: aula || '',
      horario: horario || '',
      dia: dia || '',
    });

    return { ok: true, mensaje: `Monitor ${monitor.nombre} registrado para ${materia}`, registro };
  }

  async eliminar(id) {
    const existing = await monitorRepository.findById(id);
    if (!existing) throw ApiError.notFound('Monitor no encontrado');
    await monitorRepository.deleteById(id);
    logger.info('Monitor eliminado', { id, nombre: existing.nombre_monitor });
    return { ok: true, mensaje: 'Monitor eliminado correctamente' };
  }

  // Busca si un carnet pertenece a un monitor activo de alguna clase
  async buscarMonitorPorCarnet(idCarnet) {
    return monitorRepository.findByCarnetMonitor(idCarnet);
  }

  async buscarMonitorPorDocumento(documento) {
    return monitorRepository.findByDocumentoMonitor(documento);
  }
}

module.exports = new MonitorService();
