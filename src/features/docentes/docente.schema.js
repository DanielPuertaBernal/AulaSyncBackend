'use strict';
const mongoose = require('mongoose');

const docenteSchema = new mongoose.Schema(
  {
    numero_documento: { type: String, required: true, unique: true, trim: true },
    nombre: { type: String, required: true, trim: true },
    facultad: { type: String, default: '', trim: true },
    correo: { type: String, default: '', trim: true, lowercase: true },
    id_carnet: { type: String, default: '', trim: true },
  },
  {
    collection: 'docentes',
    versionKey: false,
  }
);

docenteSchema.index({ nombre: 'text' });
docenteSchema.index({ id_carnet: 1 });

const Docente = mongoose.model('Docente', docenteSchema);
module.exports = { Docente };
