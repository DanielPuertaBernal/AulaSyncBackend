'use strict';
const llaveRepository = require('./llave.repository');
const comunidadRepository = require('../comunidad/comunidad.repository');
const ubicacionService = require('../ubicaciones/ubicacion.service');
const {
  buscarPersonaPorCarnet,
  resolverContextoNFC,
  buscarClaseParaConfirmacion,
} = require('./llave.context');
const {
  obtenerHistorialFormateado,
  formatearPendientes,
} = require('./llave.read-model');
const { createLlaveWorkflows } = require('./llave.workflows');
const {
  validarEntregaManual,
  normalizarOrigenRegistro,
  persistirPrestamo,
  persistirDevolucion,
} = require('./llave.write-model');
const { generateExcel } = require('../../shared/utils/excel.parser');
const { getFechaHoy } = require('../../shared/utils/date.helper');
const {
  construirClasesProcesadas,
  toClientFormat,
} = require('./llave.domain');
const {
  UBICACIONES: { OFICINA: UBICACION_OFICINA },
  OPERACIONES_UBICACION,
} = require('../../shared/constants/nfc.constants');

const LIMITE_HORAS_DEMORA = 4;

function toPlain(record) {
  return typeof record?.toObject === 'function' ? record.toObject() : record;
}

function formatRegistroLlave(registro) {
  return toClientFormat(registro, LIMITE_HORAS_DEMORA);
}

async function normalizarUbicacionPrestamo(ubicacion = UBICACION_OFICINA) {
  return ubicacionService.validarOperacion(ubicacion, OPERACIONES_UBICACION.PRESTAMO_LLAVES);
}

async function normalizarUbicacionDevolucion(ubicacion = UBICACION_OFICINA) {
  return ubicacionService.validarOperacion(ubicacion, OPERACIONES_UBICACION.DEVOLUCION_LLAVES);
}

class LlaveService {
  constructor() {
    this.workflows = createLlaveWorkflows({
      buscarPersonaPorCarnet,
      resolverContextoNFC,
      buscarClaseParaConfirmacion,
      findPendienteByDocumento: (documento) => llaveRepository.findPendienteByDocumento(documento),
      findDocenteByDocumento: (documento) => comunidadRepository.findByDocumento(documento),
      createRegistro: (registro) => llaveRepository.create(registro),
      normalizarUbicacionPrestamo,
      normalizarUbicacionDevolucion,
      persistirPrestamo: (payload) => persistirPrestamo({
        llaveRepository,
        ...payload,
        toClientFormat: formatRegistroLlave,
        toPlain,
      }),
      persistirDevolucion: (registro, entregaInfo = {}) => persistirDevolucion({
        llaveRepository,
        registro,
        entregaInfo,
        ubicacionPorDefecto: UBICACION_OFICINA,
        toClientFormat: formatRegistroLlave,
        toPlain,
      }),
      validarEntregaManual,
      normalizarOrigenRegistro,
    });
  }

  async obtenerPendientes() {
    const raw = await llaveRepository.findPendientes();
    const pendientes = await formatearPendientes(raw, formatRegistroLlave);

    // Enrich with docente email
    const documentos = [...new Set(pendientes.map((p) => p.documento).filter(Boolean))];
    const correoMap = new Map();
    for (const doc of documentos) {
      const docente = await comunidadRepository.findByDocumento(doc);
      if (docente?.correo) correoMap.set(doc, docente.correo);
    }
    return pendientes.map((p) => ({ ...p, correo: correoMap.get(p.documento) || '' }));
  }

  async obtenerTodosPendientes() {
    const raw = await llaveRepository.findPendientes();
    const todos = raw.map((r) => formatRegistroLlave(r));

    const documentos = [...new Set(todos.map((p) => p.documento).filter(Boolean))];
    const correoMap = new Map();
    for (const doc of documentos) {
      const docente = await comunidadRepository.findByDocumento(doc);
      if (docente?.correo) correoMap.set(doc, docente.correo);
    }
    return todos.map((p) => ({ ...p, correo: correoMap.get(p.documento) || '' }));
  }

  async obtenerPendientesHoy() {
    const raw = await llaveRepository.findPendientesByFecha(getFechaHoy());
    return formatearPendientes(raw, formatRegistroLlave);
  }

  async obtenerHistorial(filters = {}, pagination = null) {
    return obtenerHistorialFormateado(filters, pagination, formatRegistroLlave);
  }

  async obtenerClasesProcesadasHoy() {
    const registros = await llaveRepository.findByFecha(getFechaHoy());
    return construirClasesProcesadas(registros);
  }

  async procesarLecturaNFC(idCarnet, ubicacion = UBICACION_OFICINA) {
    return this.workflows.procesarLecturaNFC(idCarnet, ubicacion);
  }

  async confirmarPrestamoAnticipado(payload) {
    return this.workflows.confirmarPrestamoAnticipado({
      ...payload,
      ubicacion: payload?.ubicacion || UBICACION_OFICINA,
    });
  }

  async registrarEntrega(infoClase) {
    return this.workflows.registrarEntrega(
      infoClase,
      (record) => formatRegistroLlave(toPlain(record)),
    );
  }

  async registrarDevolucion(documento, ubicacion = UBICACION_OFICINA) {
    return this.workflows.registrarDevolucion(documento, ubicacion);
  }

  async exportarHistorial(filters = {}) {
    const result = await llaveRepository.findHistorial(filters);
    const registros = (result.data || result).map((registro) => formatRegistroLlave(registro));
    return generateExcel(registros, 'Historial Llaves');
  }
}

module.exports = new LlaveService();