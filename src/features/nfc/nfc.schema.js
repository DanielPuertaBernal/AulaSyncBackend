'use strict';
const mongoose = require('mongoose');

const nfcEventoSchema = new mongoose.Schema(
  {
    evento_id: { type: String, required: true, unique: true, index: true, trim: true },
    id_carnet: { type: String, required: true, trim: true },
    ubicacion: { type: String, default: '', trim: true },
    ok: { type: Boolean, default: false },
    tipo_resultado: { type: String, default: '', trim: true },
    mensaje_resultado: { type: String, default: '', trim: true },
    payload_resultado: { type: mongoose.Schema.Types.Mixed, default: null },
    procesado_en: { type: Date, default: Date.now },
  },
  {
    collection: 'nfc_eventos',
    versionKey: false,
  }
);

const NFCEvento = mongoose.model('NFCEvento', nfcEventoSchema);
module.exports = { NFCEvento };
