'use strict';
const { Comunidad } = require('./comunidad.schema');

class ComunidadRepository {
  async findAll(filtro = {}) {
    return Comunidad.find(filtro).lean();
  }

  async findByDocumento(documento) {
    return Comunidad.findOne({ numero_documento: String(documento) }).lean();
  }

  async findByCarnet(idCarnet) {
    return Comunidad.findOne({ id_carnet: String(idCarnet) }).lean();
  }

  async search(query, filtro = {}) {
    const escaped = String(query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');
    return Comunidad.find({
      ...filtro,
      $or: [
        { numero_documento: regex },
        { nombre: regex },
      ],
    }).lean();
  }

  async upsertOne(data) {
    return Comunidad.findOneAndUpdate(
      { numero_documento: data.numero_documento },
      { $set: data },
      { upsert: true, new: true, lean: true }
    );
  }

  async upsertMany(registros) {
    const ops = registros.map((r) => ({
      updateOne: {
        filter: { numero_documento: r.numero_documento },
        update: { $set: r },
        upsert: true,
      },
    }));
    const result = await Comunidad.bulkWrite(ops, { ordered: false });
    return {
      insertados: result.upsertedCount,
      actualizados: result.modifiedCount,
    };
  }
}

module.exports = new ComunidadRepository();
