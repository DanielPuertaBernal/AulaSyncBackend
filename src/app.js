'use strict';
require('express-async-errors');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const errorHandler = require('./shared/middlewares/error.handler');

// Feature routes
const authRoutes = require('./features/auth/auth.routes');
const usuarioRoutes = require('./features/usuarios/usuario.routes');
const docenteRoutes = require('./features/docentes/docente.routes');
const programacionRoutes = require('./features/programacion/programacion.routes');
const llaveRoutes = require('./features/llaves/llave.routes');
const equipoRoutes = require('./features/equipos/equipo.routes');
const prestamoRoutes = require('./features/prestamos/prestamo.routes');

const app = express();

// ── Middlewares globales ──────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ ok: true, timestamp: new Date().toISOString() }));

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/docentes', docenteRoutes);
app.use('/api/programacion', programacionRoutes);
app.use('/api/llaves', llaveRoutes);
app.use('/api/equipos', equipoRoutes);
app.use('/api/prestamos', prestamoRoutes);

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ ok: false, message: `Ruta ${req.method} ${req.path} no encontrada` });
});

// ── Error handler (debe ser el último) ───────────────────────────────────────
app.use(errorHandler);

module.exports = app;
