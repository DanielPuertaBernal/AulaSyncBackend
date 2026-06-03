'use strict';
const mongoose = require('mongoose');

const reservaSchema = new mongoose.Schema(
  {
    solicitante_documento: { type: String, required: true, index: true },
    solicitante_nombre: { type: String, required: true },
    nombre_bloque: { type: String, required: true, index: true },
    nombre_salon: { type: String, required: true, index: true },
    fecha: { type: Date, required: true, index: true },
    hora_inicio: { type: String, required: true },
    hora_fin: { type: String, required: true },
    motivo: { type: String, default: '' },
    estado: {
      type: String,
      enum: ['pendiente', 'aprobada', 'rechazada', 'cancelada', 'completada', 'no_reclamada'],
      default: 'pendiente',
      index: true,
    },
    entregar_llave: { type: Boolean, default: true },
    llave_entregada: { type: Boolean, default: false },
    llave_prestamo_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Llave', default: null },
    checkin_estado: {
      type: String,
      enum: ['entregado_oficina', 'pendiente_nfc', 'nfc_anticipado', 'nfc_en_tiempo', 'nfc_retraso', 'no_show'],
      default: 'pendiente_nfc',
      index: true,
    },
    checkin_canal: { type: String, enum: ['oficina', 'nfc', ''], default: '' },
    checkin_at: { type: Date, default: null },
    tipo_solicitante: { type: String, enum: ['docente', 'estudiante'], default: 'docente' },
    responsable_documento: { type: String, default: '' },
    responsable_nombre: { type: String, default: '' },
    aprobado_por: { type: String, default: '' },
    creado_por_rol: { type: String, default: '' },
  },
  {
    collection: 'reservas',
    versionKey: false,
    timestamps: true,
  }
);

reservaSchema.index(
  { nombre_salon: 1, fecha: 1, hora_inicio: 1 },
  { unique: true, partialFilterExpression: { estado: { $in: ['pendiente', 'aprobada'] } } }
);

const Reserva = mongoose.model('Reserva', reservaSchema);
module.exports = { Reserva };
