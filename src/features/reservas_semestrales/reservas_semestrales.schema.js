'use strict';
const mongoose = require('mongoose');

const reservaSemestralSchema = new mongoose.Schema(
  {
    consecutivo: { type: String, default: '', trim: true },
    aula: { type: String, default: '', trim: true },
    dia: { type: String, default: '', trim: true },
    horario: { type: String, default: '', trim: true },
    hora_inicio: { type: String, default: '', trim: true },
    hora_fin: { type: String, default: '', trim: true },
    responsable: { type: String, default: '', trim: true },
    nroidenti: { type: String, default: '', trim: true, index: true },
    facultad: { type: String, default: 'No aplica', trim: true },
    nombre_reserva: { type: String, default: '', trim: true },
    descripcion_reserva: { type: String, default: '', trim: true },
    semestre: { type: String, default: '', trim: true, index: true },
    /** Denormalizado del semestre para filtrado eficiente por día vigente */
    fecha_inicio_semestre: { type: Date, default: null },
    fecha_fin_semestre: { type: Date, default: null },
    i_cancelada: { type: Number, default: 0 },
    fecha_cancelacion: { type: String, default: '' },
    motivo_cancelacion: { type: String, default: '' },
  },
  {
    collection: 'reservas_semestrales',
    versionKey: false,
  }
);

reservaSemestralSchema.index({ dia: 1 });
reservaSemestralSchema.index({ aula: 1 });
reservaSemestralSchema.index({ fecha_inicio_semestre: 1, fecha_fin_semestre: 1 });
reservaSemestralSchema.index({ semestre: 1, dia: 1 });

const ReservaSemestral = mongoose.model('ReservaSemestral', reservaSemestralSchema);
module.exports = { ReservaSemestral };
