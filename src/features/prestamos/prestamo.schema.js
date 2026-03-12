'use strict';
/**
 * Prestamo Schema - Mongoose
 * Colección: prestamos
 */
const mongoose = require('mongoose');

const detalleEquipoSchema = new mongoose.Schema(
  {
    equipo_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Equipo', required: true },
    equipo_nombre: { type: String, default: '' },
    equipo_marca: { type: String, default: '' },
    equipo_codigo: { type: String, default: '' },
    equipo_consecutivo: { type: Number, default: 0 },
    equipo_codigo_barras: { type: String, default: '' },
    estado_equipo: { type: String, enum: ['entregado', 'devuelto'], default: 'entregado' },
    fecha_entrega: { type: Date, default: Date.now },
    fecha_devolucion: { type: Date, default: null },
    auxiliar_que_recibio_devolucion: { type: String, default: '' },
    tipo_entrega: { type: String, enum: ['manual', 'carnet', ''], default: '' },
  },
  { _id: false }
);

const prestamoSchema = new mongoose.Schema(
  {
    docente_codigo_nfc: { type: String, required: true, index: true },
    docente_nombre: { type: String, default: '' },
    auxiliar_prestamista: { type: String, default: 'Auxiliar' },
    equipos: [detalleEquipoSchema],
    estado: {
      type: String,
      enum: ['activo', 'parcialmente_devuelto', 'completamente_devuelto'],
      default: 'activo',
    },
    fecha_prestamo: { type: Date, default: Date.now },
  },
  { collection: 'prestamos', versionKey: false }
);

prestamoSchema.index({ estado: 1 });

/**
 * Devolucion Schema - Colección: devoluciones
 */
const equipoDevueltoSchema = new mongoose.Schema(
  {
    equipo_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Equipo' },
    nombre: { type: String, default: '' },
    cantidad: { type: Number, default: 1 },
    estado: { type: String, default: 'bueno' },
  },
  { _id: false }
);

const devolucionSchema = new mongoose.Schema(
  {
    prestamo_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Prestamo', required: true, index: true },
    docente_codigo_nfc: { type: String, default: '' },
    docente_nombre: { type: String, default: '' },
    equipos_devueltos: [equipoDevueltoSchema],
    auxiliar_que_recibio: { type: String, default: 'Auxiliar' },
    fecha_devolucion: { type: Date, default: Date.now },
    es_devolucion_completa: { type: Boolean, default: false },
  },
  { collection: 'devoluciones', versionKey: false }
);

const Prestamo = mongoose.model('Prestamo', prestamoSchema);
const Devolucion = mongoose.model('Devolucion', devolucionSchema);
module.exports = { Prestamo, Devolucion };
