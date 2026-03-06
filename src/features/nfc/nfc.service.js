'use strict';
const llaveService = require('../llaves/llave.service');
const nfcGateway = require('../../shared/websocket/nfc.gateway');

class NFCService {
  /**
   * Procesa lectura RFID del ESP32: identifica docente, ejecuta préstamo/devolución
   * y emite evento WebSocket al frontend
   */
  async procesarLectura(idCarnet) {
    // Modo identificacion: solo emitir carnet sin procesar programación
    if (nfcGateway.modo === 'identificacion') {
      nfcGateway.emitirCarnetLeido(idCarnet);
      return { ok: true, tipo: 'identificacion', mensaje: 'Carnet identificado' };
    }

    const resultado = await llaveService.procesarLecturaNFC(idCarnet);

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
