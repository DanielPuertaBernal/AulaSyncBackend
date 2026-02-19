'use strict';
/**
 * Llave Repository
 * Equivale a infrastructure/repositories/llave_mongo_repository.py
 */
const { Llave } = require('./llave.schema');

class LlaveRepository {
  async findPendientes() {
    return Llave.find({ 'Estado': 'En Préstamo' }).lean();
  }

  async findPendienteByDocumento(documento) {
    return Llave.findOne({ 'Número de Documento': documento, 'Estado': 'En Préstamo' }).lean();
  }

  async findByFecha(fechaStr) {
    return Llave.find({ 'Fecha de entrega': fechaStr }).lean();
  }

  async findPendientesByFecha(fechaStr) {
    return Llave.find({ 'Estado': 'En Préstamo', 'Fecha de entrega': fechaStr }).lean();
  }

  async findHistorial(filters = {}) {
    const query = {};
    if (filters.fecha) query['Fecha de entrega'] = filters.fecha;
    if (filters.documento) query['Número de Documento'] = filters.documento;
    if (filters.estado) query['Estado'] = filters.estado;
    return Llave.find(query).sort({ 'Fecha de entrega': -1, 'Hora de entrega': -1 }).lean();
  }

  async create(registro) {
    return Llave.create(registro);
  }

  async update(id, updates) {
    return Llave.findByIdAndUpdate(id, { $set: updates }, { new: true }).lean();
  }

  async ensureIndexes() {
    await Llave.collection.createIndex({ 'Número de Documento': 1 });
    await Llave.collection.createIndex({ 'Estado': 1 });
    await Llave.collection.createIndex({ 'Fecha de entrega': 1 });
  }
}

module.exports = new LlaveRepository();
