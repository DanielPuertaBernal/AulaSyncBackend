'use strict';
const swaggerJsdoc = require('swagger-jsdoc');
const path = require('path');
const { schemas } = require('./schemas');

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'AulaSync API',
      version: '1.0.0',
      description:
        'API para la gestión de préstamos de llaves, equipos, programación académica y control NFC en el Centro de Servicios Docentes.',
    },
    servers: [
      {
        url: '/api',
        description: 'API base',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Token JWT obtenido en /auth/login',
        },
        DeviceKey: {
          type: 'apiKey',
          in: 'header',
          name: 'X-Device-Key',
          description: 'Clave del dispositivo ESP32/NFC',
        },
      },
      schemas,
    },
    tags: [
      { name: 'Auth', description: 'Autenticación y sesiones' },
      { name: 'Usuarios', description: 'Gestión de usuarios del sistema' },
      { name: 'Bloques', description: 'Bloques de edificios' },
      { name: 'Comunidad', description: 'Docentes, estudiantes y empleados' },
      { name: 'Equipos', description: 'Inventario de equipos audiovisuales' },
      { name: 'Salones', description: 'Salones de clase' },
      { name: 'Ubicaciones', description: 'Ubicaciones operativas del sistema' },
      { name: 'Monitores', description: 'Asignación de monitores a docentes' },
      { name: 'Llaves', description: 'Préstamos individuales de llaves de salones' },
      { name: 'Préstamos', description: 'Préstamos de equipos audiovisuales' },
      { name: 'Programación', description: 'Programación académica semestral' },
      { name: 'NFC', description: 'Lecturas NFC desde dispositivos ESP32' },
      { name: 'Notificaciones', description: 'Notificaciones por correo electrónico' },
    ],
  },
  apis: [
    path.join(__dirname, '../../features/**/*.routes.js'),
    path.join(__dirname, './schemas.js'),
  ],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = { swaggerSpec };
