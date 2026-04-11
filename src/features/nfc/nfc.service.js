'use strict';
const llaveService = require('../llaves/llave.service');
const nfcGateway = require('../../shared/websocket/nfc.gateway');
const ubicacionService = require('../ubicaciones/ubicacion.service');
const {
  NFC_MODOS,
  OPERACIONES_UBICACION,
  UBICACIONES: { OFICINA: UBICACION_OFICINA },
} = require('../../shared/constants/nfc.constants');

class NFCService {
  obtenerEstado() {
    return nfcGateway.obtenerEstado();
  }

  /**
   * Procesa lectura RFID del ESP32: identifica docente, ejecuta préstamo/devolución
   * y emite evento WebSocket al frontend
   */
  async procesarLectura(idCarnet, ubicacion = UBICACION_OFICINA) {
    // Modo identificacion: solo emitir carnet sin procesar programación
    if (nfcGateway.modo === NFC_MODOS.IDENTIFICACION) {
      try {
        const ubicacionValidada = await ubicacionService.validarOperacion(ubicacion, OPERACIONES_UBICACION.IDENTIFICACION);
        nfcGateway.emitirCarnetLeido(idCarnet, ubicacionValidada);
        return { ok: true, tipo: NFC_MODOS.IDENTIFICACION, mensaje: 'Carnet identificado' };
      } catch (err) {
        return {
          ok: false,
          tipo: 'error',
          mensaje: err.message,
        };
      }
    }

    try {
      await ubicacionService.obtenerPorClave(ubicacion);
    } catch (err) {
      return {
        ok: false,
        tipo: 'error',
        mensaje: err.message,
      };
    }

    const resultado = await llaveService.procesarLecturaNFC(idCarnet, ubicacion);

    nfcGateway.emitirLectura({
      ...resultado,
      id_carnet: idCarnet,
      ubicacion,
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
    const nombre = resultado.persona?.nombre || resultado.docente?.nombre || 'Desconocido';
    const esMonitor = resultado.rol === 'monitor';
    const prefijo = esMonitor ? `Monitor ${nombre}` : nombre;
    switch (resultado.tipo) {
      case 'prestamo':
        return `Llave entregada a ${prefijo}`;
      case 'devolucion':
        return `Llave devuelta por ${prefijo}`;
      case 'anticipado':
        return `Reclamo anticipado de ${prefijo}`;
      case 'sin_clase':
        return resultado.mensaje;
      default:
        return 'Lectura procesada';
    }
  }
}

module.exports = new NFCService();
