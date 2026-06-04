'use strict';
const mongoose = require('mongoose');

const TIPOS_COMUNIDAD = ['docente', 'estudiante', 'empleado'];

const comunidadSchema = new mongoose.Schema(
  {
    numero_documento: { type: String, required: true, unique: true, trim: true },
    nombre: { type: String, required: true, trim: true },
    tipo: { type: String, required: true, enum: TIPOS_COMUNIDAD, index: true },
    facultad: { type: String, default: '', trim: true },
    correo: { type: String, default: '', trim: true, lowercase: true },
    id_carnet: { type: String, default: '', trim: true },
    numero_contacto: { type: String, default: '', trim: true },
  },
  {
    collection: 'comunidad',
    versionKey: false,
  }
);

comunidadSchema.index({ nombre: 'text' });
comunidadSchema.index({ id_carnet: 1 });

const Comunidad = mongoose.model('Comunidad', comunidadSchema);
module.exports = { Comunidad, TIPOS_COMUNIDAD };
