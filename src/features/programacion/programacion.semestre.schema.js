'use strict';
const mongoose = require('mongoose');

/**
 * Metadatos de cada semestre académico cargado en el sistema.
 * Se crea/actualiza automáticamente al importar un archivo Excel.
 */
const semestreSchema = new mongoose.Schema(
  {
    /** Código tal como viene en el Excel, ej: "12026" */
    codigo_raw: { type: String, required: true, trim: true },
    /** Código normalizado para mostrar, ej: "2026-1" */
    codigo: { type: String, required: true, trim: true },
    anio: { type: Number, required: true },
    periodo: { type: Number, required: true, enum: [1, 2] },
    /** Fecha de inicio del semestre (extraída del Excel: fecha_inicio) */
    fecha_inicio: { type: Date, required: true },
    /** Fecha de fin del semestre (extraída del Excel: fecha_fin) */
    fecha_fin: { type: Date, required: true },
    /** Última vez que se cargó programación de este semestre */
    fecha_carga: { type: Date, default: Date.now },
    /** Usuario que realizó la carga */
    cargado_por: { type: String, default: '' },
    /** Cantidad de registros de la última carga */
    total_registros: { type: Number, default: 0 },
  },
  {
    collection: 'programacion_semestres',
    versionKey: false,
  }
);

semestreSchema.index({ codigo: 1 }, { unique: true });
semestreSchema.index({ fecha_inicio: 1, fecha_fin: 1 });

const Semestre = mongoose.model('Semestre', semestreSchema);
module.exports = { Semestre };
