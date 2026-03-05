'use strict';
const mongoose = require('mongoose');
const { Programacion } = require('./programacion.schema');

class ProgramacionRepository {
  async findAll() {
    return Programacion.find().lean();
  }

  async findByDia(dia) {
    return Programacion.find({ dia }).lean();
  }

  async findByDocumento(documento) {
    return Programacion.find({ numero_documento: documento }).lean();
  }

  async bulkInsert(registros) {
    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      await Programacion.deleteMany({}, { session });
      const result = registros.length
        ? await Programacion.insertMany(registros, { session, ordered: false })
        : [];
      await session.commitTransaction();
      return { insertados: result.length };
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }
}

module.exports = new ProgramacionRepository();
