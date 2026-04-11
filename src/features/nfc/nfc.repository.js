'use strict';
const { NFCEvento } = require('./nfc.schema');

class NFCRepository {
  async findByEventoId(eventoId) {
    if (!eventoId) return null;
    return NFCEvento.findOne({ evento_id: eventoId }).lean();
  }

  async guardarResultado({ eventoId, idCarnet, ubicacion, resultado }) {
    if (!eventoId) return null;

    return NFCEvento.findOneAndUpdate(
      { evento_id: eventoId },
      {
        $set: {
          id_carnet: idCarnet,
          ubicacion,
          ok: Boolean(resultado?.ok),
          tipo_resultado: resultado?.tipo || '',
          mensaje_resultado: resultado?.mensaje || '',
          payload_resultado: resultado?.data || null,
          procesado_en: new Date(),
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    ).lean();
  }
}

module.exports = new NFCRepository();
