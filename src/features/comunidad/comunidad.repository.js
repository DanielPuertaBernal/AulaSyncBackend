'use strict';
const { Comunidad } = require('./comunidad.schema');

class ComunidadRepository {
  /** @param {object} filtro @returns {Promise<object[]>} */
  async findAll(filtro = {}) {
    return Comunidad.find(filtro).lean();
  }

  /** @param {string} documento @returns {Promise<object|null>} */
  async findByDocumento(documento) {
    return Comunidad.findOne({ numero_documento: String(documento) }).lean();
  }

  /** @param {string[]} documentos @returns {Promise<object[]>} */
  async findManyByDocumentos(documentos) {
    return Comunidad.find({ numero_documento: { $in: documentos } }).lean();
  }

  /** @param {string} idCarnet @returns {Promise<object|null>} */
  async findByCarnet(idCarnet) {
    return Comunidad.findOne({ id_carnet: String(idCarnet) }).lean();
  }

  /** @param {string} query - Término de búsqueda @param {object} filtro @returns {Promise<object[]>} */
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

  /** @param {object} data @returns {Promise<object>} Persona insertada o actualizada */
  async upsertOne(data) {
    return Comunidad.findOneAndUpdate(
      { numero_documento: data.numero_documento },
      { $set: data },
      { upsert: true, new: true, lean: true }
    );
  }

  /** @param {object[]} registros @returns {Promise<{insertados: number, actualizados: number}>} */
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
