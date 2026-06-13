'use strict';
const { ConfiguracionBloque } = require('./configuracion.schema');

class ConfiguracionRepository {
  async findAll() {
    return ConfiguracionBloque.find({ nombre_bloque: { $ne: '__defaults__' } })
      .sort({ nombre_bloque: 1 }).lean();
  }

  async findByBloque(nombreBloque) {
    return ConfiguracionBloque.findOne({ nombre_bloque: nombreBloque }).lean();
  }

  async upsert(nombreBloque, data) {
    return ConfiguracionBloque.findOneAndUpdate(
      { nombre_bloque: nombreBloque },
      { $set: data },
      { new: true, upsert: true, runValidators: true }
    ).lean();
  }

  async remove(nombreBloque) {
    return ConfiguracionBloque.findOneAndDelete({ nombre_bloque: nombreBloque }).lean();
  }
}

module.exports = new ConfiguracionRepository();
