'use strict';
const mongoose = require('mongoose');

const bloqueSchema = new mongoose.Schema(
  {
    nombre_bloque: { type: String, required: true, unique: true, index: true },
    fecha_creacion: { type: Date, default: Date.now },
    fecha_actualizacion: { type: Date, default: Date.now },
  },
  {
    collection: 'bloques',
    versionKey: false,
  }
);

const Bloque = mongoose.model('Bloque', bloqueSchema);
module.exports = { Bloque };
