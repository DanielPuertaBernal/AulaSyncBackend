'use strict';
const llaveService = require('../llaves/llave.service');
const nfcGateway = require('../../shared/websocket/nfc.gateway');
const ubicacionService = require('../ubicaciones/ubicacion.service');
const nfcRepository = require('./nfc.repository');
const { createLogger } = require('../../shared/utils/logger');
const {
  NFC_MODOS,
  OPERACIONES_UBICACION,
  UBICACIONES: { OFICINA: UBICACION_OFICINA },
} = require('../../shared/constants/nfc.constants');

const logger = createLogger('NFCService');

class NFCService {
  obtenerEstado() {
    return nfcGateway.obtenerEstado();
  }

  /**
   * Procesa lectura RFID del ESP32: identifica docente, ejecuta préstamo/devolución
   * y emite evento WebSocket al frontend
   */
  async procesarLectura(idCarnet, ubicacion = UBICACION_OFICINA, options = {}) {
    const eventoId = String(options?.eventoId || '').trim();
    logger.info('Lectura NFC recibida', { idCarnet, ubicacion, eventoId: eventoId || undefined });

    if (eventoId) {
      const existente = await nfcRepository.findByEventoId(eventoId);
      if (existente) {
        return {
          ok: Boolean(existente.ok),
          tipo: existente.tipo_resultado || 'procesado',
          mensaje: existente.mensaje_resultado || 'Evento NFC ya había sido procesado',
          data: existente.payload_resultado || null,
          replayed: true,
        };
      }
    }
    // Modo identificacion: solo emitir carnet sin procesar programación
    if (nfcGateway.getModoActivo() === NFC_MODOS.IDENTIFICACION) {
      try {
        const ubicacionValidada = await ubicacionService.validarOperacion(ubicacion, OPERACIONES_UBICACION.IDENTIFICACION);
        nfcGateway.emitirCarnetLeido(idCarnet, ubicacionValidada);
        return this._guardarResultadoSiAplica(eventoId, idCarnet, ubicacion, {
          ok: true,
          tipo: NFC_MODOS.IDENTIFICACION,
          mensaje: 'Carnet identificado',
          data: { id_carnet: idCarnet, ubicacion: ubicacionValidada },
        });
      } catch (err) {
        return this._guardarResultadoSiAplica(eventoId, idCarnet, ubicacion, {
          ok: false,
          tipo: 'error',
          mensaje: err.message,
          data: null,
        });
      }
    }

    try {
      await ubicacionService.obtenerPorClave(ubicacion);
    } catch (err) {
      return this._guardarResultadoSiAplica(eventoId, idCarnet, ubicacion, {
        ok: false,
        tipo: 'error',
        mensaje: err.message,
        data: null,
      });
    }

    let resultado;
    try {
      resultado = await llaveService.procesarLecturaNFC(idCarnet, ubicacion);
    } catch (err) {
      return this._guardarResultadoSiAplica(eventoId, idCarnet, ubicacion, {
        ok: false,
        tipo: 'error',
        mensaje: err.message || 'No se pudo procesar la lectura NFC',
        data: null,
      });
    }

    nfcGateway.emitirLectura({
      ...resultado,
      id_carnet: idCarnet,
      ubicacion,
      timestamp: new Date().toISOString(),
    });

    const respuesta = {
      ok: resultado.tipo !== 'error',
      tipo: resultado.tipo,
      mensaje: resultado.mensaje || this._generarMensaje(resultado),
      data: resultado,
    };

    return this._guardarResultadoSiAplica(eventoId, idCarnet, ubicacion, respuesta);
  }

  async _guardarResultadoSiAplica(eventoId, idCarnet, ubicacion, respuesta) {
    if (eventoId) {
      await nfcRepository.guardarResultado({
        eventoId,
        idCarnet,
        ubicacion,
        resultado: respuesta,
      });
    }

    return respuesta;
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
