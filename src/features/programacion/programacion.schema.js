'use strict';
/**
 * Programacion Schema - Mongoose
 * Colección: programacion
 * Mantiene estructura exacta de la BD Python existente
 */
const mongoose = require('mongoose');

const programacionSchema = new mongoose.Schema(
  {
    'Número de Documento': { type: String, required: true, trim: true },
    'Docente': { type: String, default: '', trim: true },
    'Día': { type: String, default: '', trim: true },
    'Horario': { type: String, default: '', trim: true },
    'Hora Inicio': { type: String, default: '', trim: true },
    'Hora Fin': { type: String, default: '', trim: true },
    'Aula': { type: String, default: '', trim: true },
    'Facultad': { type: String, default: '', trim: true },
    'Materia de la Clase': { type: String, default: '', trim: true },
    // Campos adicionales del Excel que se mantienen
    'Código de la Materia': { type: String, default: '' },
    'Grupo': { type: String, default: '' },
    'Nivel del Grupo': { type: String, default: '' },
    'Estudiantes Prematriculados': { type: Number, default: 0 },
    'Estudiantes Matriculados': { type: Number, default: 0 },
    'Total de Estudiantes': { type: Number, default: 0 },
    'Observaciones': { type: String, default: '' },
  },
  {
    collection: 'programacion',
    versionKey: false,
  }
);

programacionSchema.index({ 'Día': 1 });
programacionSchema.index({ 'Número de Documento': 1 });
programacionSchema.index({ 'Aula': 1 });

const Programacion = mongoose.model('Programacion', programacionSchema);
module.exports = { Programacion };
