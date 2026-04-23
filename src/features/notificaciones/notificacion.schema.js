'use strict';
const mongoose = require('mongoose');

const notificacionSchema = new mongoose.Schema(
  {
    destinatario_nombre: { type: String, required: true },
    destinatario_documento: { type: String, required: true },
    destinatario_correo: { type: String, required: true },
    tipo_mensaje: {
      type: String,
      enum: ['predeterminado', 'personalizado'],
      required: true,
    },
    asunto: { type: String, required: true },
    mensaje: { type: String, default: '' },
    llave_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Llave', default: null },
    prestamo_llave_id: { type: mongoose.Schema.Types.ObjectId, default: null },
    salon: { type: String, default: '' },
    tipo_notificacion: {
      type: String,
      enum: ['manual', 'vencimiento_inicial', 'recordatorio'],
      default: 'manual',
    },
    numero_recordatorio: { type: Number, default: 0 },
    estado_envio: {
      type: String,
      enum: ['pendiente', 'enviado', 'fallido'],
      default: 'pendiente',
    },
    intentos_envio: { type: Number, default: 0 },
    proximo_reintento: { type: Date, default: null },
    error_envio: { type: String, default: '' },
    enviado_por: { type: String, default: '' },
    fecha_envio: { type: Date, default: Date.now },
    fecha_hora_prestamo: { type: Date, default: null },
  },
  {
    collection: 'notificaciones',
    versionKey: false,
  }
);

notificacionSchema.index({ fecha_envio: -1 });
notificacionSchema.index({ destinatario_documento: 1, fecha_envio: -1 });
notificacionSchema.index({ estado_envio: 1, proximo_reintento: 1 });
notificacionSchema.index(
  { prestamo_llave_id: 1, tipo_notificacion: 1, numero_recordatorio: 1 },
  { unique: true, sparse: true }
);

const Notificacion = mongoose.model('Notificacion', notificacionSchema);
module.exports = { Notificacion };
