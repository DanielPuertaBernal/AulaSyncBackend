'use strict';

const UBICACIONES = Object.freeze({
  OFICINA: 'oficina_centro_servicios_docentes',
  PORTERIA_SUPERIOR: 'porteria_superior',
});

const UBICACIONES_PERMITIDAS = Object.freeze(Object.values(UBICACIONES));
const UBICACIONES_PRESTAMO_EQUIPOS = Object.freeze([UBICACIONES.OFICINA]);

const OPERACIONES_UBICACION = Object.freeze({
  IDENTIFICACION: 'identificacion',
  PRESTAMO_LLAVES: 'prestamo_llaves',
  DEVOLUCION_LLAVES: 'devolucion_llaves',
  PRESTAMO_EQUIPOS: 'prestamo_equipos',
});

const NFC_MODOS = Object.freeze({
  AUTO: 'auto',
  IDENTIFICACION: 'identificacion',
});

const NFC_MODOS_PERMITIDOS = Object.freeze(Object.values(NFC_MODOS));

module.exports = {
  UBICACIONES,
  UBICACIONES_PERMITIDAS,
  UBICACIONES_PRESTAMO_EQUIPOS,
  OPERACIONES_UBICACION,
  NFC_MODOS,
  NFC_MODOS_PERMITIDOS,
};
