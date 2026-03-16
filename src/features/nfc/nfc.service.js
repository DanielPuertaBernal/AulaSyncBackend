'use strict';
const llaveService = require('../llaves/llave.service');
const nfcGateway = require('../../shared/websocket/nfc.gateway');

const UBICACION_OFICINA = 'oficina_centro_servicios_docentes';

class NFCService {
  /**
   * Procesa lectura RFID del ESP32: identifica docente, ejecuta préstamo/devolución
   * y emite evento WebSocket al frontend
   */
  async procesarLectura(idCarnet, ubicacion = 'oficina_centro_servicios_docentes') {
    // Modo identificacion: solo emitir carnet sin procesar programación
    if (nfcGateway.modo === 'identificacion') {
      if (ubicacion !== UBICACION_OFICINA) {
        return {
          ok: false,
          tipo: 'error',
          mensaje: 'La identificación para préstamos de equipos solo se permite en la Oficina Centro de Servicios Docentes',
        };
      }
      nfcGateway.emitirCarnetLeido(idCarnet, ubicacion);
      return { ok: true, tipo: 'identificacion', mensaje: 'Carnet identificado' };
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
