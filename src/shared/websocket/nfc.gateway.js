'use strict';
/**
 * NFC Gateway - WebSocket + SerialPort
 * Sistema de intención NFC con cola de espera FIFO.
 * Solo el cliente con intención activa recibe eventos NFC.
 */
const { EventEmitter } = require('events');
const jwt = require('jsonwebtoken');
const {
  NFC_MODOS,
  NFC_MODOS_PERMITIDOS,
  UBICACIONES,
} = require('../constants/nfc.constants');

const DEBOUNCE_MS = parseInt(process.env.NFC_DEBOUNCE_MS || '2000', 10);
const JWT_ISSUER = process.env.JWT_ISSUER || 'aulasync-api';
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'aulasync-clients';
const INTENCION_TTL_MS = 60_000;

class NFCGateway extends EventEmitter {
  constructor() {
    super();
    this._io = null;
    this._port = null;
    this._lastRead = '';
    this._lastReadTime = 0;
    this._lastReadAt = null;
    this._active = false;
    this._desiredActive = false;
    this._opening = false;
    this._lastError = '';
    this._reconnectTimer = null;
    this._portPath = process.env.NFC_PORT || '/dev/ttyUSB0';
    this._baudRate = parseInt(process.env.NFC_BAUD_RATE || '9600', 10);

    // Sistema de intención NFC
    this._intencionActiva = null; // { socketId, modo, userId, expiresAt, timer }
    this._colaEspera = [];        // [{ socketId, modo, userId }]
  }

  getModoActivo() {
    return this._intencionActiva?.modo || NFC_MODOS.AUTO;
  }

  obtenerEstado() {
    return {
      activo: this._active,
      escuchando: this._desiredActive,
      modo: this.getModoActivo(),
      puerto: this._portPath,
      puertoAbierto: Boolean(this._port?.isOpen),
      ultimoCodigo: this._lastRead || null,
      ultimaLectura: this._lastReadAt,
      ultimoError: this._lastError || null,
      lectorOcupado: this._intencionActiva !== null,
      expiraEn: this._intencionActiva ? Math.max(0, this._intencionActiva.expiresAt - Date.now()) : null,
      enCola: this._colaEspera.length,
    };
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

  _emitStatus(mensaje = '') {
    if (!this._io) return;
    this._io.of('/nfc').emit('nfc:status', {
      ...this.obtenerEstado(),
      mensaje,
    });
  }

  _emitError(mensaje) {
    this._lastError = mensaje;
    if (this._io) {
      this._io.of('/nfc').emit('nfc:error', { mensaje });
    }
    this._emitStatus(mensaje);
  }

  _scheduleReconnect() {
    if (!this._desiredActive || this._reconnectTimer) return;

    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      this._startListening(this._io?.of('/nfc'));
    }, 1500);

    this._emitStatus('Intentando reconectar lector NFC...');
  }

  // ─── Sistema de intención NFC ───

  _programarExpiracion(socketId) {
    if (!this._intencionActiva || this._intencionActiva.socketId !== socketId) return;
    if (this._intencionActiva.timer) clearTimeout(this._intencionActiva.timer);

    this._intencionActiva.expiresAt = Date.now() + INTENCION_TTL_MS;
    this._intencionActiva.timer = setTimeout(() => {
      if (this._intencionActiva?.socketId === socketId) {
        const sock = this._io?.of('/nfc').sockets.get(socketId);
        if (sock) sock.emit('nfc:intencion_expirada');
        console.log(`⏰ Intención NFC expirada: ${socketId}`);
        this._liberarIntencion();
      }
    }, INTENCION_TTL_MS);
  }

  _renovarIntencion(socketId) {
    if (!this._intencionActiva || this._intencionActiva.socketId !== socketId) return;
    this._programarExpiracion(socketId);
  }

  _liberarIntencion() {
    if (this._intencionActiva?.timer) {
      clearTimeout(this._intencionActiva.timer);
    }
    this._intencionActiva = null;

    // Promover siguiente en cola
    if (this._colaEspera.length > 0) {
      const siguiente = this._colaEspera.shift();
      this._intencionActiva = { ...siguiente, expiresAt: 0, timer: null };
      this._programarExpiracion(siguiente.socketId);

      const sock = this._io?.of('/nfc').sockets.get(siguiente.socketId);
      if (sock) {
        sock.emit('nfc:intencion_confirmada', { modo: siguiente.modo });
      }

      // Actualizar posiciones de los restantes en cola
      this._emitPosicionesCola();
      this._emitStatus(`Lector NFC asignado (modo: ${siguiente.modo})`);
    } else {
      // Nadie en cola → lector libre
      if (this._io) {
        this._io.of('/nfc').emit('nfc:lector_libre');
      }
      this._emitStatus('Lector NFC disponible');
    }
  }

  _emitPosicionesCola() {
    this._colaEspera.forEach((entry, idx) => {
      const sock = this._io?.of('/nfc').sockets.get(entry.socketId);
      if (sock) {
        sock.emit('nfc:posicion_cola', {
          posicion: idx + 1,
          expiraEn: this._intencionActiva
            ? Math.max(0, this._intencionActiva.expiresAt - Date.now())
            : null,
        });
      }
    });
  }

  _registrarIntencion(socket, { modo }) {
    if (!NFC_MODOS_PERMITIDOS.includes(modo)) return;

    const socketId = socket.id;
    const userId = socket.data.user?.id || socket.data.user?.sub;

    // Si ya tiene la intención activa → renovar TTL
    if (this._intencionActiva?.socketId === socketId) {
      this._intencionActiva.modo = modo;
      this._renovarIntencion(socketId);
      socket.emit('nfc:intencion_confirmada', { modo });
      return;
    }

    // Si ya está en cola → actualizar modo e ignorar
    const enCola = this._colaEspera.find((e) => e.socketId === socketId);
    if (enCola) {
      enCola.modo = modo;
      return;
    }

    // Mismo userId en otro tab → reemplazar
    if (this._intencionActiva && userId && this._intencionActiva.userId === userId) {
      const prevSocket = this._io?.of('/nfc').sockets.get(this._intencionActiva.socketId);
      if (prevSocket) prevSocket.emit('nfc:intencion_reemplazada');
      if (this._intencionActiva.timer) clearTimeout(this._intencionActiva.timer);

      this._intencionActiva = { socketId, modo, userId, expiresAt: 0, timer: null };
      this._programarExpiracion(socketId);
      socket.emit('nfc:intencion_confirmada', { modo });
      this._emitStatus(`Lector NFC asignado (modo: ${modo})`);
      return;
    }

    // No hay intención activa → asignar directamente
    if (!this._intencionActiva) {
      this._intencionActiva = { socketId, modo, userId, expiresAt: 0, timer: null };
      this._programarExpiracion(socketId);
      socket.emit('nfc:intencion_confirmada', { modo });
      this._emitStatus(`Lector NFC asignado (modo: ${modo})`);
      return;
    }

    // Hay intención activa de otro usuario → encolar
    this._colaEspera.push({ socketId, modo, userId });
    socket.emit('nfc:en_cola', {
      posicion: this._colaEspera.length,
      expiraEn: Math.max(0, this._intencionActiva.expiresAt - Date.now()),
    });
  }

  _cancelarIntencion(socket) {
    const socketId = socket.id;

    if (this._intencionActiva?.socketId === socketId) {
      this._liberarIntencion();
      return;
    }

    const idx = this._colaEspera.findIndex((e) => e.socketId === socketId);
    if (idx !== -1) {
      this._colaEspera.splice(idx, 1);
      this._emitPosicionesCola();
    }
  }

  _handleDisconnect(socket) {
    const socketId = socket.id;

    if (this._intencionActiva?.socketId === socketId) {
      this._liberarIntencion();
      return;
    }

    const idx = this._colaEspera.findIndex((e) => e.socketId === socketId);
    if (idx !== -1) {
      this._colaEspera.splice(idx, 1);
      this._emitPosicionesCola();
    }
  }

  // ─── Socket handlers ───

  _registerSocketHandlers() {
    const nsp = this._io.of('/nfc');

    nsp.use((socket, next) => {
      const authToken = String(socket.handshake.auth?.token || '');
      const authHeader = String(socket.handshake.headers?.authorization || '');
      const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
      const token = authToken || bearerToken;

      if (!token) {
        return next(new Error('No autenticado para usar el canal NFC'));
      }

      try {
        const payload = jwt.verify(token, process.env.JWT_SECRET, {
          issuer: JWT_ISSUER,
          audience: JWT_AUDIENCE,
        });

        if (payload?.type !== 'access') {
          return next(new Error('Tipo de token inválido para el canal NFC'));
        }

        socket.data.user = payload;
        return next();
      } catch (_) {
        return next(new Error('Token inválido para el canal NFC'));
      }
    });

    nsp.on('connection', (socket) => {
      console.log(`🔌 Cliente NFC conectado: ${socket.id} (${socket.data.user?.usuario || 'desconocido'})`);
      socket.emit('nfc:status', {
        ...this.obtenerEstado(),
        mensaje: this._active ? 'Escuchando NFC...' : 'Conectado al servidor NFC',
      });

      socket.on('nfc:start', () => this._startListening(nsp));
      socket.on('nfc:stop', () => this._stopListening(nsp));

      // Intención NFC
      socket.on('nfc:registrar_intencion', (data) => this._registrarIntencion(socket, data || {}));
      socket.on('nfc:cancelar_intencion', () => this._cancelarIntencion(socket));
      socket.on('nfc:renovar_intencion', () => this._renovarIntencion(socket.id));

      socket.on('disconnect', () => {
        console.log(`🔌 Cliente NFC desconectado: ${socket.id}`);
        this._handleDisconnect(socket);
      });
    });
  }

  async _connectSerial() {
    if (this._port) return;

    try {
      const { SerialPort } = require('serialport');
      const { ReadlineParser } = require('@serialport/parser-readline');

      this._port = new SerialPort({
        path: this._portPath,
        baudRate: this._baudRate,
        autoOpen: false,
      });

      const parser = this._port.pipe(new ReadlineParser({ delimiter: '\n' }));
      parser.on('data', (line) => this._handleNFCRead(line.trim()));

      this._port.on('error', (err) => {
        this._opening = false;
        const mensaje = `Error SerialPort NFC: ${err.message}`;
        console.warn('⚠️ ', mensaje);
        this._emitError(mensaje);
      });

      this._port.on('close', () => {
        this._opening = false;
        const debeReintentar = this._desiredActive;
        this._active = false;

        if (debeReintentar) {
          this._emitStatus('Puerto NFC cerrado. Reintentando conexión...');
          this._scheduleReconnect();
        }
      });

      console.log(`🔧 SerialPort NFC configurado en ${this._portPath}@${this._baudRate}`);
    } catch (err) {
      const mensaje = `serialport no disponible o sin puerto NFC físico: ${err.message}`;
      this._lastError = mensaje;
      console.warn('⚠️ ', mensaje);
    }
  }

  async _startListening(nsp) {
    this._desiredActive = true;
    await this._connectSerial();

    if (!this._port) {
      this._emitError('No hay puerto serial NFC disponible');
      return;
    }

    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }

    if (this._port.isOpen) {
      this._active = true;
      this._lastError = '';
      this._emitStatus('Escuchando NFC...');
      return;
    }

    if (this._opening) return;

    this._opening = true;
    this._port.open((err) => {
      this._opening = false;
      if (err) {
        this._active = false;
        this._emitError(`No se pudo abrir puerto: ${err.message}`);
        this._scheduleReconnect();
        return;
      }

      this._active = true;
      this._lastError = '';
      if (nsp) {
        nsp.emit('nfc:status', {
          ...this.obtenerEstado(),
          mensaje: 'Escuchando NFC...',
        });
      } else {
        this._emitStatus('Escuchando NFC...');
      }
    });
  }

  _stopListening(nsp) {
    this._desiredActive = false;
    this._active = false;
    this._lastError = '';

    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }

    if (this._port && this._port.isOpen) {
      this._port.close((err) => {
        if (err) {
          this._emitError(`No se pudo cerrar el puerto NFC: ${err.message}`);
        }
      });
    }

    if (nsp) {
      nsp.emit('nfc:status', {
        ...this.obtenerEstado(),
        mensaje: 'NFC detenido',
      });
    } else {
      this._emitStatus('NFC detenido');
    }
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
    this._lastReadAt = new Date().toISOString();

    const payload = { codigo: rawData, timestamp: this._lastReadAt };
    console.log('📡 NFC leído:', payload);

    // Emitir al namespace /nfc
    if (this._io) {
      this._io.of('/nfc').emit('nfc:lectura', payload);
    }
    this.emit('lectura', payload);
  }

  /**
   * Emite resultado de lectura procesada al frontend.
   * Si hay intención activa, solo al socket dueño y luego libera.
   * Si no hay intención, broadcast normal (retrocompatibilidad).
   */
  emitirLectura(data) {
    if (this._io) {
      if (this._intencionActiva) {
        const sock = this._io.of('/nfc').sockets.get(this._intencionActiva.socketId);
        if (sock) sock.emit('nfc:resultado', data);
        this._liberarIntencion();
      } else {
        this._io.of('/nfc').emit('nfc:resultado', data);
      }
    }
    this.emit('resultado', data);
  }

  emitirCarnetLeido(idCarnet, ubicacion = UBICACIONES.OFICINA) {
    if (this._io) {
      const payload = {
        id_carnet: idCarnet,
        ubicacion,
        timestamp: new Date().toISOString(),
      };
      if (this._intencionActiva) {
        const sock = this._io.of('/nfc').sockets.get(this._intencionActiva.socketId);
        if (sock) sock.emit('nfc:carnet_leido', payload);
        this._liberarIntencion();
      } else {
        this._io.of('/nfc').emit('nfc:carnet_leido', payload);
      }
    }
  }
}

module.exports = new NFCGateway();
