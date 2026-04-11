'use strict';
const mongoose = require('mongoose');

const ubicacionSchema = new mongoose.Schema(
  {
    clave: {
      type: String,
      required: [true, 'La clave es requerida'],
      unique: true,
      trim: true,
      lowercase: true,
    },
    nombre: {
      type: String,
      required: [true, 'El nombre es requerido'],
      trim: true,
    },
    descripcion: {
      type: String,
      default: '',
      trim: true,
    },
    activa: {
      type: Boolean,
      default: true,
      index: true,
    },
    permite_identificacion: {
      type: Boolean,
      default: false,
    },
    permite_prestamo_llaves: {
      type: Boolean,
      default: false,
    },
    permite_devolucion_llaves: {
      type: Boolean,
      default: false,
    },
    permite_prestamo_equipos: {
      type: Boolean,
      default: false,
    },
    creado_por: {
      type: String,
      default: '',
      trim: true,
    },
    actualizado_por: {
      type: String,
      default: '',
      trim: true,
    },
    fecha_creacion: {
      type: Date,
      default: Date.now,
    },
    fecha_actualizacion: {
      type: Date,
      default: null,
    },
  },
  {
    collection: 'ubicaciones_operativas',
    versionKey: false,
  }
);

const Ubicacion = mongoose.model('Ubicacion', ubicacionSchema);

module.exports = { Ubicacion };
