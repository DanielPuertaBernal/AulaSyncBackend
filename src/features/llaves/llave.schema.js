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
    fecha_hora_entrega: { type: Date, default: null, index: true },
    fecha_hora_devolucion: { type: Date, default: null },
    duracion: { type: String, default: '' },
    se_reclamo_a_tiempo: { type: Boolean, default: false },
    tiempo_retraso: { type: String, default: '' },
    retraso_entrega: { type: Boolean, default: false },
    tiempo_retraso_devolucion: { type: String, default: '' },
    tipo_entrega: { type: String, enum: ['manual', 'carnet', ''], default: '' },
    // Quién reclamó la llave
    quien_reclama: { type: String, enum: ['docente', 'monitor', ''], default: '' },
    numero_documento_reclama: { type: String, default: '' },
    nombre_reclama: { type: String, default: '' },
    // Quién devolvió la llave
    quien_entrega: { type: String, enum: ['docente', 'monitor', ''], default: '' },
    numero_documento_entrega: { type: String, default: '' },
    nombre_entrega: { type: String, default: '' },
    estado: {
      type: String,
      enum: ['en_prestamo', 'entregado', 'demora_entrega'],
      default: 'en_prestamo',
      index: true,
    },
  },
  {
    collection: 'registros_llaves',
    versionKey: false,
  }
);

const Llave = mongoose.model('Llave', llaveSchema);
module.exports = { Llave };
