'use strict';
const mongoose = require('mongoose');

const llaveSchema = new mongoose.Schema(
  {
    numero_documento: { type: String, required: true, index: true },
    docente: { type: String, default: '' },
    dia: { type: String, default: '' },
    horario: { type: String, default: '' },
    aula: { type: String, default: '' },
    facultad: { type: String, default: 'No especificada' },
    materia: { type: String, default: '' },
    fecha_entrega: { type: Date, default: null, index: true },
    fecha_devolucion: { type: Date, default: null },
    duracion: { type: String, default: '' },
    reclamo_a_tiempo: { type: Boolean, default: false },
    tiempo_retraso: { type: String, default: '' },
    retraso_entrega: { type: String, default: 'No' },
    tiempo_retraso_devolucion: { type: String, default: '' },
    estado: { type: String, enum: ['en_prestamo', 'devuelta'], default: 'en_prestamo', index: true },
  },
  {
    collection: 'registros_llaves',
    versionKey: false,
  }
);

const Llave = mongoose.model('Llave', llaveSchema);
module.exports = { Llave };
