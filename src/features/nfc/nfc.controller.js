'use strict';
const nfcService = require('./nfc.service');

class NFCController {
  async procesarLectura(req, res) {
    const deviceKey = req.headers['x-device-key'];
    const expectedKey = process.env.ESP32_DEVICE_KEY || 'esp32-aulasync-device-key-2026';

    if (!deviceKey || deviceKey !== expectedKey) {
      return res.status(403).json({ ok: false, message: 'Device key inválido' });
    }

    const { id_carnet, ubicacion } = req.body;
    const resultado = await nfcService.procesarLectura(id_carnet, ubicacion);
    const status = resultado.ok ? 200 : 404;
    return res.status(status).json(resultado);
  }
}

module.exports = new NFCController();
