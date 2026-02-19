'use strict';
const { Prestamo, Devolucion } = require('./prestamo.schema');
const mongoose = require('mongoose');

class PrestamoRepository {
  async findAll() { return Prestamo.find().lean(); }
  async findActivos() { return Prestamo.find({ estado: 'activo' }).lean(); }
  async findById(id) { return Prestamo.findById(id).lean(); }
  async findByDocente(codigoNfc) { return Prestamo.find({ docente_codigo_nfc: codigoNfc }).lean(); }
  async findActivoByDocente(codigoNfc) {
    return Prestamo.findOne({ docente_codigo_nfc: codigoNfc, estado: 'activo' }).lean();
  }

  async create(data) { return (await Prestamo.create(data)).toObject(); }

  async update(id, updates) {
    return Prestamo.findByIdAndUpdate(id, { $set: updates }, { new: true }).lean();
  }

  async addEquipo(id, equipoDetalle) {
    return Prestamo.findByIdAndUpdate(
      id,
      { $push: { equipos: equipoDetalle } },
      { new: true }
    ).lean();
  }

  async verificarEquipoPrestado(equipoId) {
    return Prestamo.exists({
      estado: { $in: ['activo', 'parcialmente_devuelto'] },
      'equipos.equipo_id': new mongoose.Types.ObjectId(equipoId),
      'equipos.estado_equipo': 'entregado',
    });
  }
}

class DevolucionRepository {
  async create(data) { return (await Devolucion.create(data)).toObject(); }
  async findByPrestamo(prestamoId) { return Devolucion.find({ prestamo_id: prestamoId }).lean(); }
}

module.exports = {
  prestamoRepository: new PrestamoRepository(),
  devolucionRepository: new DevolucionRepository(),
};
