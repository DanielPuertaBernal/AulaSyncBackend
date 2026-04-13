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
    salon: { type: String, default: '' },
    estado_envio: {
      type: String,
      enum: ['enviado', 'fallido'],
      default: 'enviado',
    },
    error_envio: { type: String, default: '' },
    enviado_por: { type: String, default: '' },
    fecha_envio: { type: Date, default: Date.now },
  },
  {
    collection: 'notificaciones',
    versionKey: false,
  }
);

notificacionSchema.index({ fecha_envio: -1 });
notificacionSchema.index({ destinatario_documento: 1, fecha_envio: -1 });

const Notificacion = mongoose.model('Notificacion', notificacionSchema);
module.exports = { Notificacion };
