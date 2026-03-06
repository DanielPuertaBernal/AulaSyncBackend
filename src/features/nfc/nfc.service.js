'use strict';
const llaveService = require('../llaves/llave.service');
const nfcGateway = require('../../shared/websocket/nfc.gateway');

class NFCService {
  /**
   * Procesa lectura RFID del ESP32: identifica docente, ejecuta préstamo/devolución
   * y emite evento WebSocket al frontend
   */
  async procesarLectura(idCarnet) {
    const resultado = await llaveService.procesarLecturaNFC(idCarnet);

    // Emitir al frontend via WebSocket
    nfcGateway.emitirLectura({
      ...resultado,
      id_carnet: idCarnet,
      timestamp: new Date().toISOString(),
    });

    return {
      ok: resultado.tipo !== 'error',
      tipo: resultado.tipo,
      mensaje: resultado.mensaje || this._generarMensaje(resultado),
      data: resultado,
    };
  }

  _generarMensaje(resultado) {
    const nombre = resultado.docente?.nombre || 'Desconocido';
    switch (resultado.tipo) {
      case 'prestamo':
        return `Llave entregada a ${nombre}`;
      case 'devolucion':
        return `Llave devuelta por ${nombre}`;
      case 'anticipado':
        return `Reclamo anticipado de ${nombre}`;
      case 'sin_clase':
        return resultado.mensaje;
      default:
        return 'Lectura procesada';
    }
  }
}

module.exports = new NFCService();
