'use strict';
const mongoose = require('mongoose');

const salonSchema = new mongoose.Schema(
  {
    nombre_salon: { type: String, required: true, unique: true, index: true },
    nombre_bloque: { type: String, required: true, index: true },
    capacidad_estudiantes: { type: Number, required: true, min: 1 },
    tipo_silleteria: { type: String, required: true },
    fecha_creacion: { type: Date, default: Date.now },
    fecha_actualizacion: { type: Date, default: Date.now },
  },
  {
    collection: 'salones',
    versionKey: false,
  }
);

const Salon = mongoose.model('Salon', salonSchema);
module.exports = { Salon };
