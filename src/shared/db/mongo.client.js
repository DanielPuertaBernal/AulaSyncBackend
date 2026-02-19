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
    const password = encodeURIComponent(process.env.MONGO_PASSWORD);
    const dbName = process.env.MONGO_DB;

    // Insertar contraseña en el URI si tiene el placeholder
    let connectionUri = uri.replace('://', `://${process.env.MONGO_URI.includes('@') ? '' : ''}`)
      .replace('mongodb+srv://', `mongodb+srv://DanielPB:${password}@`)
      .replace('DanielPB:' + password + '@DanielPB@', `DanielPB:${password}@`);

    // Forma segura: reemplazar usuario sin password por usuario:password
    const uriConPassword = uri.replace(
      /mongodb\+srv:\/\/([^:@]+)@/,
      `mongodb+srv://$1:${password}@`
    );

    try {
      this._connection = await mongoose.connect(uriConPassword, {
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
