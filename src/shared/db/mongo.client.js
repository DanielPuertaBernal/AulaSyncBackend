'use strict';
/**
 * MongoDB Client - Singleton Mongoose connection
 * Equivalente a infrastructure/services/mongo_client.py
 */
const mongoose = require('mongoose');

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
      console.log(`✅ MongoDB conectado → ${dbName}`);
      return this._connection;
    } catch (err) {
      console.error('❌ Error conectando a MongoDB:', err.message);
      throw err;
    }
  }

  async disconnect() {
    await mongoose.disconnect();
    this._connection = null;
    console.log('🔌 MongoDB desconectado');
  }

  getConnection() {
    return mongoose.connection;
  }
}

module.exports = new MongoClient();
