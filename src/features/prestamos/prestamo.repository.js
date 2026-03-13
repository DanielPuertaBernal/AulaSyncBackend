'use strict';
const { Prestamo, Devolucion } = require('./prestamo.schema');
const mongoose = require('mongoose');

class PrestamoRepository {
  async findAll() { return Prestamo.find().lean(); }
  async findActivos() {
    return Prestamo.find({ estado: { $in: ['activo', 'parcialmente_devuelto'] } }).lean();
  }
  async findById(id, session = null) {
    const query = Prestamo.findById(id).lean();
    if (session) query.session(session);
    return query;
  }
  async findByDocente(codigoNfc, session = null) {
    const query = Prestamo.find({ docente_codigo_nfc: codigoNfc }).lean();
    if (session) query.session(session);
    return query;
  }
  async findActivoByDocente(codigoNfc, session = null) {
    const query = Prestamo.findOne({
      docente_codigo_nfc: codigoNfc,
      estado: { $in: ['activo', 'parcialmente_devuelto'] },
    }).lean();
    if (session) query.session(session);
    return query;
  }

  async create(data, session = null) {
    if (session) {
      const [doc] = await Prestamo.create([data], { session });
      return doc.toObject();
    }
    return (await Prestamo.create(data)).toObject();
  }

  async update(id, updates, session = null) {
    return Prestamo.findByIdAndUpdate(id, { $set: updates }, { new: true, session }).lean();
  }

  async addEquipo(id, equipoDetalle) {
    return Prestamo.findByIdAndUpdate(
      id,
      { $push: { equipos: equipoDetalle } },
      { new: true }
    ).lean();
  }

  async verificarEquipoPrestado(equipoId, session = null) {
    const query = Prestamo.exists({
      estado: { $in: ['activo', 'parcialmente_devuelto'] },
      'equipos.equipo_id': new mongoose.Types.ObjectId(equipoId),
      'equipos.estado_equipo': 'entregado',
    });
    if (session) query.session(session);
    return query;
  }
}

class DevolucionRepository {
  async create(data, session = null) {
    if (session) {
      const [doc] = await Devolucion.create([data], { session });
      return doc.toObject();
    }
    return (await Devolucion.create(data)).toObject();
  }
  async findByPrestamo(prestamoId) { return Devolucion.find({ prestamo_id: prestamoId }).lean(); }
}

module.exports = {
  prestamoRepository: new PrestamoRepository(),
  devolucionRepository: new DevolucionRepository(),
};
