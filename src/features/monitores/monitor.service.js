'use strict';
const monitorRepository = require('./monitor.repository');
const docenteRepository = require('../docentes/docente.repository');
const programacionRepository = require('../programacion/programacion.repository');

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
    const docente = await docenteRepository.findByDocumento(numero_documento_docente);
    if (!docente) throw Object.assign(new Error('Docente no encontrado'), { statusCode: 404 });

    const monitor = await docenteRepository.findByDocumento(numero_documento_monitor);
    if (!monitor) throw Object.assign(new Error('Persona no encontrada en el sistema'), { statusCode: 404 });

    if (numero_documento_docente === numero_documento_monitor) {
      throw Object.assign(new Error('El docente no puede ser monitor de sí mismo'), { statusCode: 400 });
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
    if (!existing) throw Object.assign(new Error('Monitor no encontrado'), { statusCode: 404 });
    await monitorRepository.deleteById(id);
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
