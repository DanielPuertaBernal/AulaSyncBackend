'use strict';
const mongoose = require('mongoose');

const programacionSchema = new mongoose.Schema(
  {
    semestre: { type: String, default: '', trim: true },
    numero_documento: { type: String, required: true, trim: true },
    docente: { type: String, default: '', trim: true },
    dia: { type: String, default: '', trim: true },
    horario: { type: String, default: '', trim: true },
    hora_inicio: { type: String, default: '', trim: true },
    hora_fin: { type: String, default: '', trim: true },
    aula: { type: String, default: '', trim: true },
    facultad: { type: String, default: '', trim: true },
    materia: { type: String, default: '', trim: true },
    codigo_materia: { type: String, default: '' },
    grupo: { type: String, default: '' },
    nivel_grupo: { type: String, default: '' },
    estudiantes_prematriculados: { type: Number, default: 0 },
    estudiantes_matriculados: { type: Number, default: 0 },
    total_estudiantes: { type: Number, default: 0 },
    observaciones: { type: String, default: '' },
  },
  {
    collection: 'programacion',
    versionKey: false,
  }
);

programacionSchema.index({ dia: 1 });
programacionSchema.index({ numero_documento: 1 });
programacionSchema.index({ aula: 1 });

const Programacion = mongoose.model('Programacion', programacionSchema);
module.exports = { Programacion };
