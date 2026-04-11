'use strict';
/**
 * Usuario Schema - Mongoose
 * Colección: usuarios
 * Estructura compatible con la BD Python existente
 */
const mongoose = require('mongoose');

const ROLES = {
  ADMIN: 'admin_programacion',
  AUX: 'auxiliar_programacion',
};

const sesionSchema = new mongoose.Schema(
  {
    token_hash: { type: String, required: true },
    user_agent: { type: String, default: '' },
    ip: { type: String, default: '' },
    created_at: { type: Date, default: Date.now },
    expires_at: { type: Date, required: true },
    revoked_at: { type: Date, default: null },
  },
  { _id: false }
);

const usuarioSchema = new mongoose.Schema(
  {
    usuario: {
      type: String,
      required: [true, 'El usuario es requerido'],
      unique: true,
      trim: true,
      minlength: [3, 'Mínimo 3 caracteres'],
      maxlength: [50, 'Máximo 50 caracteres'],
    },
    nombre: {
      type: String,
      required: [true, 'El nombre es requerido'],
      trim: true,
      minlength: [2, 'Mínimo 2 caracteres'],
    },
    email: {
      type: String,
      required: [true, 'El email es requerido'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Email inválido'],
    },
    contacto: {
      type: String,
      default: '',
      trim: true,
    },
    rol: {
      type: String,
      enum: Object.values(ROLES),
      required: [true, 'El rol es requerido'],
    },
    hash_password: {
      type: String,
      required: [true, 'La contraseña es requerida'],
      select: false, // no retornar por defecto en queries
    },
    activo: {
      type: Boolean,
      default: true,
    },
    sesiones: {
      type: [sesionSchema],
      default: [],
      select: false,
    },
    fecha_creacion: {
      type: Date,
      default: Date.now,
    },
  },
  {
    collection: 'usuarios', // mantener nombre de colección existente
    versionKey: false,
  }
);

const Usuario = mongoose.model('Usuario', usuarioSchema);

module.exports = { Usuario, ROLES };
