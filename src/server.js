'use strict';
/**
 * server.js - HTTP + Socket.io server bootstrap
 */
require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');

const app = require('./app');
const mongoClient = require('./shared/db/mongo.client');
const nfcGateway = require('./shared/websocket/nfc.gateway');

const PORT = process.env.PORT || 3001;

async function bootstrap() {
  // 1. Conectar MongoDB
  await mongoClient.connect();

  // 2. Crear servidor HTTP + Socket.io
  const httpServer = http.createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      credentials: true,
    },
  });

  // 3. Iniciar gateway NFC
  await nfcGateway.start(io);

  // 4. Escuchar
  httpServer.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
    console.log(`📡 WebSocket NFC en ws://localhost:${PORT}/nfc`);
    console.log(`🌍 Ambiente: ${process.env.NODE_ENV || 'development'}`);
  });

  // 5. Manejo de errores no capturados
  process.on('uncaughtException', (err) => {
    console.error('💥 uncaughtException:', err);
    process.exit(1);
  });
  process.on('unhandledRejection', (reason) => {
    console.error('💥 unhandledRejection:', reason);
    process.exit(1);
  });
}

bootstrap().catch((err) => {
  console.error('❌ Error iniciando servidor:', err);
  process.exit(1);
});
