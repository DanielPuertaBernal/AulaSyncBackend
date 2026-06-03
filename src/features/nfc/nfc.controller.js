'use strict';
const nfcService = require('./nfc.service');

class NFCController {
  /** GET /api/nfc/estado */
  async obtenerEstado(req, res) {
    return res.json({ ok: true, data: nfcService.obtenerEstado() });
  }

  /** POST /api/nfc/lectura - Procesa lectura RFID del ESP32 */
  async procesarLectura(req, res) {
    const { id_carnet, ubicacion, evento_id } = req.body;
    const resultado = await nfcService.procesarLectura(id_carnet, ubicacion, { eventoId: evento_id });
    const status = resultado.ok ? 200 : 404;
    return res.status(status).json(resultado);
  }
}

module.exports = new NFCController();
