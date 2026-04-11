'use strict';
const nfcService = require('./nfc.service');

class NFCController {
  async procesarLectura(req, res) {
    const { id_carnet, ubicacion } = req.body;
    const resultado = await nfcService.procesarLectura(id_carnet, ubicacion);
    const status = resultado.ok ? 200 : 404;
    return res.status(status).json(resultado);
  }
}

module.exports = new NFCController();
