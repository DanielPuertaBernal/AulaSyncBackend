'use strict';
const mongoose = require('mongoose');

const programacionSchema = new mongoose.Schema(
  {
    /** 'programacion' para clases regulares, 'semestral' para reservas semestrales */
    tipo: { type: String, enum: ['programacion', 'semestral'], required: true, default: 'programacion', trim: true },
    semestre: { type: String, default: '', trim: true },
    /** Fecha de inicio del semestre al que pertenece este registro */
    fecha_inicio_semestre: { type: Date, default: null },
    /** Fecha de fin del semestre al que pertenece este registro */
    fecha_fin_semestre: { type: Date, default: null },
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
    /** Campos exclusivos de registros tipo 'semestral' */
    consecutivo: { type: String, default: '', trim: true },
    nroidenti: { type: String, default: '', trim: true },
    responsable: { type: String, default: '', trim: true },
    nombre_reserva: { type: String, default: '', trim: true },
    descripcion_reserva: { type: String, default: '', trim: true },
    i_cancelada: { type: Number, default: 0 },
    fecha_cancelacion: { type: String, default: '', trim: true },
    motivo_cancelacion: { type: String, default: '', trim: true },
  },
  {
    collection: 'programacion',
    versionKey: false,
  }
);

programacionSchema.index({ tipo: 1 });
programacionSchema.index({ semestre: 1 });
programacionSchema.index({ semestre: 1, tipo: 1 });
programacionSchema.index({ semestre: 1, dia: 1 });
programacionSchema.index({ tipo: 1, dia: 1 });
programacionSchema.index({ dia: 1 });
programacionSchema.index({ numero_documento: 1 });
programacionSchema.index({ aula: 1 });

const Programacion = mongoose.model('Programacion', programacionSchema);
module.exports = { Programacion };
