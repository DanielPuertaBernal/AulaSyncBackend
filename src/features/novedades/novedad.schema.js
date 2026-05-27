'use strict';
const mongoose = require('mongoose');

const novedadSchema = new mongoose.Schema(
  {
    tipo_recurso: {
      type: String,
      enum: ['llave', 'equipo'],
      required: true,
      index: true,
    },
    recurso_id: { type: mongoose.Schema.Types.ObjectId, default: null },
    prestamo_ref: { type: mongoose.Schema.Types.ObjectId, default: null },
    reportado_por: { type: String, required: true, index: true },
    reportado_por_nombre: { type: String, default: '' },
    salon: { type: String, default: '' },
    categoria: {
      type: String,
      enum: ['sin_novedad', 'daño_fisico', 'no_funciona', 'perdida', 'otro', 'demora_entrega'],
      required: true,
    },
    descripcion: { type: String, maxlength: 500, default: '' },
    estado: {
      type: String,
      enum: ['abierta', 'en_revision', 'resuelta', 'cerrada'],
      default: 'abierta',
      index: true,
    },
    resolucion: { type: String, default: '' },
    fecha_reporte: { type: Date, default: Date.now, index: true },
    fecha_resolucion: { type: Date, default: null },
    notificacion_admin_enviada: { type: Boolean, default: false },
  },
  {
    collection: 'novedades',
    versionKey: false,
    timestamps: true,
  }
);

novedadSchema.index({ tipo_recurso: 1, recurso_id: 1 });

const Novedad = mongoose.model('Novedad', novedadSchema);
module.exports = { Novedad };
