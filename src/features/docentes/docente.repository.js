'use strict';
const { Docente } = require('./docente.schema');

class DocenteRepository {
  async findAll() {
    return Docente.find().lean();
  }

  async findByDocumento(documento) {
    return Docente.findOne({ numero_documento: String(documento) }).lean();
  }

  async findByCarnet(idCarnet) {
    return Docente.findOne({ id_carnet: String(idCarnet) }).lean();
  }

  async search(query) {
    const escaped = String(query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');
    return Docente.find({
      $or: [
        { numero_documento: regex },
        { nombre: regex },
      ],
    }).lean();
  }

  async bulkUpsert(docentes) {
    const ops = docentes.map((d) => ({
      updateOne: {
        filter: { numero_documento: d.numero_documento },
        update: { $set: d },
        upsert: true,
      },
    }));
    const result = await Docente.bulkWrite(ops, { ordered: false });
    return {
      insertados: result.upsertedCount,
      actualizados: result.modifiedCount,
    };
  }
}

module.exports = new DocenteRepository();
