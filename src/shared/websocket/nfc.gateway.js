'use strict';
/**
 * NFC Gateway - WebSocket + SerialPort
 * Equivale a infrastructure/services/nfc_service.py + pyserial
 * Emite eventos NFC en tiempo real al frontend via Socket.io
 */
const { EventEmitter } = require('events');

const DEBOUNCE_MS = 2000;

class NFCGateway extends EventEmitter {
  constructor() {
    super();
    this._io = null;
    this._port = null;
    this._lastRead = '';
    this._lastReadTime = 0;
    this._active = false;
  }

  /**
   * Inicia el gateway NFC
   * @param {import('socket.io').Server} io
   */
  async start(io) {
    this._io = io;
    this._registerSocketHandlers();
    await this._connectSerial();
  }

  _registerSocketHandlers() {
    const nsp = this._io.of('/nfc');
    nsp.on('connection', (socket) => {
      console.log(`🔌 Cliente NFC conectado: ${socket.id}`);
      socket.emit('nfc:status', { activo: this._active, mensaje: 'Conectado al servidor NFC' });

      socket.on('nfc:start', () => this._startListening(nsp));
      socket.on('nfc:stop', () => this._stopListening(nsp));
      socket.on('nfc:simulate', ({ codigo }) => {
        if (codigo) this.simularLectura(codigo);
      });
      socket.on('disconnect', () => {
        console.log(`🔌 Cliente NFC desconectado: ${socket.id}`);
      });
    });
  }

  async _connectSerial() {
    try {
      const { SerialPort } = require('serialport');
      const { ReadlineParser } = require('@serialport/parser-readline');

      const portPath = process.env.NFC_PORT || '/dev/ttyUSB0';
      const baudRate = parseInt(process.env.NFC_BAUD_RATE || '9600', 10);

      this._port = new SerialPort({ path: portPath, baudRate, autoOpen: false });
      const parser = this._port.pipe(new ReadlineParser({ delimiter: '\n' }));

      parser.on('data', (line) => this._handleNFCRead(line.trim()));
      this._port.on('error', (err) => {
        console.warn('⚠️  Error SerialPort NFC:', err.message);
      });

      console.log(`🔧 SerialPort NFC configurado en ${portPath}@${baudRate}`);
    } catch (err) {
      console.warn('⚠️  serialport no disponible o sin puerto NFC físico:', err.message);
    }
  }

  _startListening(nsp) {
    if (this._active) return;
    if (this._port && !this._port.isOpen) {
      this._port.open((err) => {
        if (err) {
          nsp.emit('nfc:error', { mensaje: `No se pudo abrir puerto: ${err.message}` });
          return;
        }
        this._active = true;
        nsp.emit('nfc:status', { activo: true, mensaje: 'Escuchando NFC...' });
      });
    } else {
      this._active = true;
      nsp.emit('nfc:status', { activo: true, mensaje: 'Escuchando NFC...' });
    }
  }

  _stopListening(nsp) {
    this._active = false;
    if (this._port && this._port.isOpen) {
      this._port.close();
    }
    nsp && nsp.emit('nfc:status', { activo: false, mensaje: 'NFC detenido' });
  }

  /**
   * Procesa una lectura NFC con debounce de 2 segundos
   * @param {string} rawData
   */
  _handleNFCRead(rawData) {
    if (!this._active || !rawData) return;

    const ahora = Date.now();
    if (rawData === this._lastRead && ahora - this._lastReadTime < DEBOUNCE_MS) {
      return; // duplicado ignorado
    }

    this._lastRead = rawData;
    this._lastReadTime = ahora;

    const payload = { codigo: rawData, timestamp: new Date().toISOString() };
    console.log('📡 NFC leído:', payload);

    // Emitir al namespace /nfc
    if (this._io) {
      this._io.of('/nfc').emit('nfc:lectura', payload);
    }
    this.emit('lectura', payload);
  }

  /**
   * Simula una lectura NFC (para testing sin hardware)
   * @param {string} codigo
   */
  simularLectura(codigo) {
    this._handleNFCRead(codigo);
  }

  /**
   * Emite resultado de lectura procesada al frontend (usado por NFC HTTP endpoint)
   * @param {object} data
   */
  emitirLectura(data) {
    if (this._io) {
      this._io.of('/nfc').emit('nfc:resultado', data);
    }
    this.emit('resultado', data);
  }
}

module.exports = new NFCGateway();
