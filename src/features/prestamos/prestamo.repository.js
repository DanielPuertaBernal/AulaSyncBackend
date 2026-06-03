'use strict';
const { Prestamo, Devolucion } = require('./prestamo.schema');
const mongoose = require('mongoose');

class PrestamoRepository {
  /** @returns {Promise<object[]>} */
  async findAll() { return Prestamo.find().lean(); }
  /** @returns {Promise<object[]>} Préstamos activos o parcialmente devueltos */
  async findActivos() {
    return Prestamo.find({ estado: { $in: ['activo', 'parcialmente_devuelto'] } }).lean();
  }
  /** @param {string} id @param {object} [session] @returns {Promise<object|null>} */
  async findById(id, session = null) {
    const query = Prestamo.findById(id).lean();
    if (session) query.session(session);
    return query;
  }
  /** @param {string} codigoNfc @param {object} [session] @returns {Promise<object[]>} */
  async findByDocente(codigoNfc, session = null) {
    const query = Prestamo.find({ docente_codigo_nfc: codigoNfc }).lean();
    if (session) query.session(session);
    return query;
  }
  /** @param {string} codigoNfc @param {object} [session] @returns {Promise<object|null>} */
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

  /** @param {string} id @param {object} updates @param {object} [session] @returns {Promise<object|null>} */
  async update(id, updates, session = null) {
    return Prestamo.findByIdAndUpdate(id, { $set: updates }, { new: true, session }).lean();
  }

  /** @param {string} id @param {object} equipoDetalle @param {object} [session] @returns {Promise<object|null>} */
  async addEquipo(id, equipoDetalle, session = null) {
    return Prestamo.findByIdAndUpdate(
      id,
      { $push: { equipos: equipoDetalle } },
      { new: true, session }
    ).lean();
  }

  /** @param {string[]} equiposIds @param {object} [session] @returns {Promise<object[]>} */
  async findEquiposPrestados(equiposIds = [], session = null) {
    if (!equiposIds.length) return [];

    const objectIds = equiposIds.map((id) => new mongoose.Types.ObjectId(id));
    const query = Prestamo.find(
      {
        estado: { $in: ['activo', 'parcialmente_devuelto'] },
        equipos: {
          $elemMatch: {
            equipo_id: { $in: objectIds },
            estado_equipo: 'entregado',
          },
        },
      },
      {
        equipos: 1,
      }
    ).lean();

    if (session) query.session(session);
    return query;
  }

  /** @param {string} equipoId @param {object} [session] @returns {Promise<boolean>} */
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
  /** @param {object} data @param {object} [session] @returns {Promise<object>} */
  async create(data, session = null) {
    if (session) {
      const [doc] = await Devolucion.create([data], { session });
      return doc.toObject();
    }
    return (await Devolucion.create(data)).toObject();
  }
  /** @param {string} prestamoId @returns {Promise<object[]>} */
  async findByPrestamo(prestamoId) { return Devolucion.find({ prestamo_id: prestamoId }).lean(); }
}

module.exports = {
  prestamoRepository: new PrestamoRepository(),
  devolucionRepository: new DevolucionRepository(),
};
