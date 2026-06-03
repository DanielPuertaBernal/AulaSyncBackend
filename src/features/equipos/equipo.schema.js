'use strict';
/**
 * Equipo Schema - Mongoose
 * Colección: equipos
 */
const mongoose = require('mongoose');

const equipoSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: true, trim: true },
    marca: { type: String, default: '', trim: true },
    consecutivo: { type: Number, required: true },
    codigo_inventario: { type: String, required: false, default: null, unique: true, sparse: true, trim: true },
    codigo_barras: { type: String, default: '', trim: true },
    descripcion: { type: String, default: '' },
    estado: {
      type: String,
      enum: ['activo', 'inactivo', 'mantenimiento'],
      default: 'activo',
    },
    fecha_creacion: { type: Date, default: Date.now },
    fecha_actualizacion: { type: Date, default: Date.now },
  },
  { collection: 'equipos', versionKey: false }
);

equipoSchema.index({ codigo_barras: 1 });
equipoSchema.index({ estado: 1 });

const Equipo = mongoose.model('Equipo', equipoSchema);
module.exports = { Equipo };
