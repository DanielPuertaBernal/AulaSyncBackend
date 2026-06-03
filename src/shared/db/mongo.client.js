'use strict';
const mongoose = require('mongoose');
const { createLogger } = require('../utils/logger');
const log = createLogger('MongoDB');

class MongoClient {
  constructor() {
    this._connection = null;
  }

  async connect() {
    if (this._connection) return this._connection;

    const uri = process.env.MONGO_URI;
    const dbName = process.env.MONGO_DB;
    const password = process.env.MONGO_PASSWORD;
    const connectionUri = password
      ? uri.replace('<password>', encodeURIComponent(password))
      : uri;

    try {
      this._connection = await mongoose.connect(connectionUri, {
        dbName,
        serverSelectionTimeoutMS: 10000,
      });
      log.info(`Conectado a ${dbName}`);
      return this._connection;
    } catch (err) {
      log.error('Error de conexión', err);
      throw err;
    }
  }

  async disconnect() {
    await mongoose.disconnect();
    this._connection = null;
    log.info('Desconectado');
  }

  getConnection() {
    return mongoose.connection;
  }
}

module.exports = new MongoClient();
