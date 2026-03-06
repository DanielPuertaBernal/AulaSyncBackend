'use strict';
const { Monitor } = require('./monitor.schema');

class MonitorRepository {
  async findByDocente(documentoDocente) {
    return Monitor.find({ numero_documento_docente: documentoDocente, activo: true }).lean();
  }

  async findByCarnetMonitor(idCarnet) {
    return Monitor.find({ id_carnet_monitor: idCarnet, activo: true }).lean();
  }

  async findByDocumentoMonitor(documentoMonitor) {
    return Monitor.find({ numero_documento_monitor: documentoMonitor, activo: true }).lean();
  }

  async findAll() {
    return Monitor.find({ activo: true }).lean();
  }

  async create(data) {
    return Monitor.create(data);
  }

  async deleteById(id) {
    return Monitor.findByIdAndUpdate(id, { $set: { activo: false } }, { new: true }).lean();
  }

  async findById(id) {
    return Monitor.findById(id).lean();
  }
}

module.exports = new MonitorRepository();
