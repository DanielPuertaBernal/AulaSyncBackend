'use strict';
const mongoose = require('mongoose');

const monitorSchema = new mongoose.Schema(
  {
    // Docente titular
    numero_documento_docente: { type: String, required: true, trim: true },
    nombre_docente: { type: String, default: '', trim: true },
    // Monitor (estudiante)
    numero_documento_monitor: { type: String, required: true, trim: true },
    nombre_monitor: { type: String, default: '', trim: true },
    id_carnet_monitor: { type: String, default: '', trim: true },
    facultad_monitor: { type: String, default: '', trim: true },
    correo_monitor: { type: String, default: '', trim: true },
    // Materia a la que está asignado
    materia: { type: String, required: true, trim: true },
    aula: { type: String, default: '', trim: true },
    horario: { type: String, default: '', trim: true },
    dia: { type: String, default: '', trim: true },
    activo: { type: Boolean, default: true },
  },
  {
    collection: 'monitores',
    versionKey: false,
    timestamps: true,
  }
);

monitorSchema.index({ numero_documento_docente: 1 });
monitorSchema.index({ numero_documento_monitor: 1 });
monitorSchema.index({ id_carnet_monitor: 1 });
monitorSchema.index(
  { numero_documento_docente: 1, numero_documento_monitor: 1, materia: 1, dia: 1, horario: 1 },
  { unique: true }
);

const Monitor = mongoose.model('Monitor', monitorSchema);
module.exports = { Monitor };
