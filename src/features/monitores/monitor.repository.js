'use strict';
const { Monitor } = require('./monitor.schema');

class MonitorRepository {
  /** @param {string} documentoDocente @returns {Promise<object[]>} */
  async findByDocente(documentoDocente) {
    return Monitor.find({ numero_documento_docente: documentoDocente, activo: true }).lean();
  }

  /** @param {string} idCarnet @returns {Promise<object[]>} Monitores activos con ese carnet */
  async findByCarnetMonitor(idCarnet) {
    return Monitor.find({ id_carnet_monitor: idCarnet, activo: true }).lean();
  }

  /** @param {string} documentoMonitor @returns {Promise<object[]>} */
  async findByDocumentoMonitor(documentoMonitor) {
    return Monitor.find({ numero_documento_monitor: documentoMonitor, activo: true }).lean();
  }

  /** @returns {Promise<object[]>} Monitores activos */
  async findAll() {
    return Monitor.find({ activo: true }).lean();
  }

  /** @param {object} data @returns {Promise<object>} */
  async create(data) {
    return Monitor.create(data);
  }

  /** @param {string} id @returns {Promise<object|null>} Soft delete (activo=false) */
  async deleteById(id) {
    return Monitor.findByIdAndUpdate(id, { $set: { activo: false } }, { new: true }).lean();
  }

  /** @param {string} id @returns {Promise<object|null>} */
  async findById(id) {
    return Monitor.findById(id).lean();
  }
}

module.exports = new MonitorRepository();
