'use strict';
const mongoose = require('mongoose');

const tipoSilleteriaSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: true, unique: true, index: true },
    fecha_creacion: { type: Date, default: Date.now },
    fecha_actualizacion: { type: Date, default: Date.now },
  },
  {
    collection: 'tipos_silleteria',
    versionKey: false,
  }
);

const TipoSilleteria = mongoose.model('TipoSilleteria', tipoSilleteriaSchema);
module.exports = { TipoSilleteria };
