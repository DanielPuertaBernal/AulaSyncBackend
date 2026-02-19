'use strict';
/**
 * Docente Schema - Mongoose
 * Colección: docentes
 * Mantiene estructura exacta de la BD Python existente
 */
const mongoose = require('mongoose');

const docenteSchema = new mongoose.Schema(
  {
    'Numero de documento': { type: String, required: true, unique: true, trim: true },
    'Nombre': { type: String, required: true, trim: true },
    'Facultad': { type: String, default: '', trim: true },
    'Correo': { type: String, default: '', trim: true, lowercase: true },
    'Id Carnet': { type: String, default: '', trim: true },
  },
  {
    collection: 'docentes',
    versionKey: false,
  }
);

docenteSchema.index({ 'Nombre': 'text' });
docenteSchema.index({ 'Id Carnet': 1 });

const Docente = mongoose.model('Docente', docenteSchema);
module.exports = { Docente };
