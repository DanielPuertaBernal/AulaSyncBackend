'use strict';
/**
 * Llave Schema - Mongoose
 * Colección: registros_llaves
 * Mantiene estructura exacta de la BD Python existente
 */
const mongoose = require('mongoose');

const llaveSchema = new mongoose.Schema(
  {
    'Número de Documento': { type: String, required: true, index: true },
    'Docente': { type: String, default: '' },
    'Día': { type: String, default: '' },
    'Horario': { type: String, default: '' },
    'Aula': { type: String, default: '' },
    'Facultad': { type: String, default: 'No especificada' },
    'Materia de la Clase': { type: String, default: '' },
    'Fecha de entrega': { type: String, default: '', index: true },
    'Hora de entrega': { type: String, default: '' },
    'Fecha de devolución': { type: String, default: '' },
    'Hora de devolución': { type: String, default: '' },
    'Duración clase (entrega→devolución)': { type: String, default: '' },
    'Se reclamó a tiempo': { type: Boolean, default: false },
    'Tiempo de retraso': { type: String, default: '' },
    'Retraso en entrega': { type: String, default: 'No' },
    'Tiempo retraso devolución': { type: String, default: '' },
    'Estado': { type: String, enum: ['En Préstamo', 'Devuelta'], default: 'En Préstamo', index: true },
  },
  {
    collection: 'registros_llaves',
    versionKey: false,
  }
);

const Llave = mongoose.model('Llave', llaveSchema);
module.exports = { Llave };
