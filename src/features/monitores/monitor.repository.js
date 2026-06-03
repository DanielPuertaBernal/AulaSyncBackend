'use strict';
const BaseRepository = require('../../shared/db/base.repository');
const { Monitor } = require('./monitor.schema');

class MonitorRepository extends BaseRepository {
  constructor() { super(Monitor); }

  /** @returns {Promise<object[]>} Monitores activos */
  async findAll() {
    return this.Model.find({ activo: true }).lean();
  }

  /** @param {string} documentoDocente @returns {Promise<object[]>} */
  async findByDocente(documentoDocente) {
    return this.Model.find({ numero_documento_docente: documentoDocente, activo: true }).lean();
  }

  /** @param {string} idCarnet @returns {Promise<object[]>} Monitores activos con ese carnet */
  async findByCarnetMonitor(idCarnet) {
    return this.Model.find({ id_carnet_monitor: idCarnet, activo: true }).lean();
  }

  /** @param {string} documentoMonitor @returns {Promise<object[]>} */
  async findByDocumentoMonitor(documentoMonitor) {
    return this.Model.find({ numero_documento_monitor: documentoMonitor, activo: true }).lean();
  }

  /** @param {object} data @returns {Promise<object>} */
  async create(data) {
    return this.Model.create(data);
  }

  /** Soft delete: marca activo=false en lugar de eliminar el documento.
   * @param {string} id @returns {Promise<object|null>} */
  async deleteById(id) {
    return this.Model.findByIdAndUpdate(id, { $set: { activo: false } }, { new: true }).lean();
  }
}

module.exports = new MonitorRepository();
