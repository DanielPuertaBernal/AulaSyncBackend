'use strict';
const mongoose = require('mongoose');

const configuracionBloqueSchema = new mongoose.Schema(
  {
    nombre_bloque: {
      type: String,
      required: [true, 'El nombre del bloque es requerido'],
      unique: true,
      trim: true,
    },
    tiempo_maximo_prestamo_minutos: {
      type: Number,
      default: 120,
      min: [5, 'El tiempo mínimo es 5 minutos'],
    },
    intervalo_recordatorio_minutos: {
      type: Number,
      default: 30,
      min: [5, 'El intervalo mínimo es 5 minutos'],
    },
    max_recordatorios: {
      type: Number,
      default: 5,
      min: [1, 'Mínimo 1 recordatorio'],
      max: [20, 'Máximo 20 recordatorios'],
    },
    notificaciones_activas: {
      type: Boolean,
      default: true,
    },
  },
  {
    collection: 'configuracion_bloques',
    timestamps: true,
    versionKey: false,
  }
);

const ConfiguracionBloque = mongoose.model('ConfiguracionBloque', configuracionBloqueSchema);
module.exports = { ConfiguracionBloque };
