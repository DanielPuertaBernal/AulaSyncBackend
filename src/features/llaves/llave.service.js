'use strict';
const llaveRepository = require('./llave.repository');
const comunidadRepository = require('../comunidad/comunidad.repository');
const ubicacionService = require('../ubicaciones/ubicacion.service');
const { createLogger } = require('../../shared/utils/logger');
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
const reservaRepository = require('../reservas/reserva.repository');

const LIMITE_HORAS_DEMORA = 4;
const logger = createLogger('Llaves');

function toPlain(record) {
  return typeof record?.toObject === 'function' ? record.toObject() : record;
}

function formatRegistroLlave(registro) {
  return toClientFormat(registro, LIMITE_HORAS_DEMORA);
}

async function normalizarUbicacion(operacion, ubicacion = UBICACION_OFICINA) {
  return ubicacionService.validarOperacion(ubicacion, operacion);
}

class LlaveService {
  constructor() {
    this.workflows = createLlaveWorkflows({
      buscarPersonaPorCarnet,
      resolverContextoNFC,
      buscarClaseParaConfirmacion,
      findPendienteByDocumento: (documento) => llaveRepository.findPendienteByDocumento(documento),
      findRegistroById: (id) => llaveRepository.findById(id),
      findReservaPendienteNFCByDocumento: (documento, now) => reservaRepository.findReservaPendienteNFCByDocumento(documento, now),
      findReservaById: (id) => reservaRepository.findById(id),
      marcarReservaCheckinNFC: (payload) => reservaRepository.marcarCheckinNFC(payload),
      findDocenteByDocumento: (documento) => comunidadRepository.findByDocumento(documento),
      createRegistro: (registro) => llaveRepository.create(registro),
      normalizarUbicacionPrestamo: (loc) => normalizarUbicacion(OPERACIONES_UBICACION.PRESTAMO_LLAVES, loc),
      normalizarUbicacionDevolucion: (loc) => normalizarUbicacion(OPERACIONES_UBICACION.DEVOLUCION_LLAVES, loc),
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

  async #enriquecerConCorreos(pendientes) {
    const documentos = [...new Set(pendientes.map((p) => p.documento).filter(Boolean))];
    const correoMap = new Map();
    for (const doc of documentos) {
      const docente = await comunidadRepository.findByDocumento(doc);
      if (docente?.correo) correoMap.set(doc, docente.correo);
    }
    return pendientes.map((p) => ({ ...p, correo: correoMap.get(p.documento) || '' }));
  }

  async obtenerPendientes() {
    const raw = await llaveRepository.findPendientes();
    const pendientes = await formatearPendientes(raw, formatRegistroLlave);
    return this.#enriquecerConCorreos(pendientes);
  }

  async obtenerTodosPendientes() {
    const raw = await llaveRepository.findPendientes();
    return this.#enriquecerConCorreos(raw.map(formatRegistroLlave));
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
    logger.info('Procesando lectura NFC', { idCarnet, ubicacion });
    return this.workflows.procesarLecturaNFC(idCarnet, ubicacion);
  }

  async confirmarPrestamoAnticipado(payload) {
    return this.workflows.confirmarPrestamoAnticipado({
      ...payload,
      ubicacion: payload?.ubicacion || UBICACION_OFICINA,
    });
  }

  async registrarEntrega(infoClase) {
    logger.info('Registrando entrega manual de llave', { salon: infoClase?.salon });
    return this.workflows.registrarEntrega(
      infoClase,
      (record) => formatRegistroLlave(toPlain(record)),
    );
  }

  async registrarDevolucion(documento, ubicacion = UBICACION_OFICINA) {
    logger.info('Registrando devolución de llave', { documento, ubicacion });
    return this.workflows.registrarDevolucion(documento, ubicacion);
  }

  async registrarDevolucionPorId(registroId, ubicacion = UBICACION_OFICINA) {
    logger.info('Registrando devolución de llave por ID', { registroId, ubicacion });
    return this.workflows.registrarDevolucionPorId(registroId, ubicacion);
  }

  async exportarHistorial(filters = {}) {
    logger.info('Exportando historial de llaves', filters);
    const result = await llaveRepository.findHistorial(filters);
    const registros = (result.data || result).map((registro) => formatRegistroLlave(registro));
    return generateExcel(registros, 'Historial Llaves');
  }
}

module.exports = new LlaveService();