'use strict';
const llaveRepository = require('./llave.repository');
const docenteRepository = require('../docentes/docente.repository');
const programacionRepository = require('../programacion/programacion.repository');
const monitorRepository = require('../monitores/monitor.repository');
const ubicacionService = require('../ubicaciones/ubicacion.service');
const ApiError = require('../../shared/errors/api.error');
const { generateExcel } = require('../../shared/utils/excel.parser');
const {
  getFechaHoy,
  getDiaActual,
  calcularRetrasoDevolucion,
  calcularDuracion,
  calcularTiempoRetraso,
  esReclamoAnticipado,
} = require('../../shared/utils/date.helper');
const {
  normalizeAula,
  normalizeHorario,
  normalizeString,
} = require('../../shared/utils/normalize.helper');
const {
  normalizarDocumento,
  matchMonitorClase,
  horarioCubiertoPorPrestamo,
  agruparClasesConsecutivas,
  encontrarClaseActual,
  toClientFormat,
} = require('./llave.domain');
const {
  UBICACIONES: { OFICINA: UBICACION_OFICINA },
  OPERACIONES_UBICACION,
} = require('../../shared/constants/nfc.constants');

const LIMITE_HORAS_DEMORA = 4;

class LlaveService {
  async obtenerPendientes() {
    const raw = await llaveRepository.findPendientes();
    return this._formatearPendientes(raw);
  }

  async obtenerPendientesHoy() {
    const raw = await llaveRepository.findPendientesByFecha(getFechaHoy());
    return this._formatearPendientes(raw);
  }

  async obtenerHistorial(filters = {}, pagination = null) {
    const repositoryFilters = { ...filters };
    if (repositoryFilters.estado) {
      delete repositoryFilters.estado;
    }

    const aplicarFiltroEstado = (items) => {
      if (!filters.estado) return items;
      return items.filter((item) => item.estado === filters.estado);
    };

    if (pagination && filters.estado) {
      const fullResult = await llaveRepository.findHistorial(repositoryFilters, null);
      const source = fullResult.data || fullResult;
      const transformed = aplicarFiltroEstado(source.map((registro) => this._toClientFormat(registro)));
      const { page, limit } = pagination;
      const start = (page - 1) * limit;
      const data = transformed.slice(start, start + limit);
      return {
        data,
        meta: {
          page,
          limit,
          total: transformed.length,
          totalPages: Math.ceil(transformed.length / limit),
        },
      };
    }

    const result = await llaveRepository.findHistorial(repositoryFilters, pagination);

    if (pagination) {
      return { data: result.data.map((registro) => this._toClientFormat(registro)), meta: result.meta };
    }

    return aplicarFiltroEstado((result.data || result).map((registro) => this._toClientFormat(registro)));
  }

  async obtenerClasesProcesadasHoy() {
    const registros = await llaveRepository.findByFecha(getFechaHoy());
    return registros.map((registro) => ({
      documento: normalizarDocumento(registro.numero_documento),
      horario: String(registro.horario || '').trim(),
    }));
  }

  async procesarLecturaNFC(idCarnet, ubicacion = UBICACION_OFICINA) {
    const persona = await this._buscarPersonaPorCarnet(idCarnet);
    if (!persona) {
      return { tipo: 'error', mensaje: 'Persona no encontrada para este carnet' };
    }

    const documento = normalizarDocumento(persona.numero_documento);
    const contexto = await this._resolverContextoNFC(persona, documento);

    if (contexto.prestamoActivo) {
      return this._resolverResultadoDevolucion({ contexto, persona, documento, ubicacion });
    }

    return this._resolverResultadoPrestamo({ contexto, persona, documento, ubicacion });
  }

  async confirmarPrestamoAnticipado({
    id_carnet,
    horario,
    aula,
    rol,
    documento_persona,
    nombre_persona,
    ubicacion = UBICACION_OFICINA,
  }) {
    const ubicacionPrestamo = await this._normalizarUbicacionPrestamo(ubicacion);
    const persona = await this._buscarPersonaPorCarnet(id_carnet);
    if (!persona) {
      throw ApiError.notFound('Persona no encontrada');
    }

    const { clase, docenteDoc } = await this._buscarClaseParaConfirmacion({
      persona,
      aula,
      horario,
      rol,
    });

    if (!clase) {
      throw ApiError.notFound('Clase no encontrada en la programación');
    }

    const existing = await llaveRepository.findPendienteByDocumento(docenteDoc);
    if (existing) {
      throw ApiError.conflict('Ya hay una llave prestada para este docente');
    }

    const docente = await docenteRepository.findByDocumento(docenteDoc);
    const registro = await this._ejecutarPrestamo(
      docente || persona,
      clase,
      true,
      '',
      {
        quien: rol || 'docente',
        documento: documento_persona || docenteDoc,
        nombre: nombre_persona || persona.nombre,
      },
      'manual',
      ubicacionPrestamo
    );

    return {
      ok: true,
      mensaje: `Llave entregada a ${(docente || persona).nombre}`,
      registro,
      docente: docente || persona,
    };
  }

  async registrarEntrega(infoClase) {
    const ubicacionPrestamo = await this._normalizarUbicacionPrestamo(infoClase.ubicacion);
    const origenRegistro = this._normalizarOrigenRegistro(infoClase.origen);
    this._validarEntregaManual(infoClase);

    const documento = normalizarDocumento(infoClase.nroidenti);
    const existing = await llaveRepository.findPendienteByDocumento(documento);
    if (existing) {
      throw ApiError.conflict('El docente ya tiene una llave prestada');
    }

    const registro = this._construirRegistroEntregaManual({
      infoClase,
      documento,
      ubicacionPrestamo,
      origenRegistro,
    });

    const created = await llaveRepository.create(registro);
    return {
      ok: true,
      mensaje: `Llave entregada a ${infoClase.profesor}`,
      registro: this._toClientFormat(this._toPlain(created)),
    };
  }

  async registrarDevolucion(documento, ubicacion = UBICACION_OFICINA) {
    const doc = normalizarDocumento(documento);
    const registro = await llaveRepository.findPendienteByDocumento(doc);
    if (!registro) {
      throw ApiError.notFound('No se encontró llave en préstamo para este docente');
    }

    const ubicacionDevolucion = await this._normalizarUbicacionDevolucion(ubicacion);
    const result = await this._ejecutarDevolucion(registro, { ubicacion: ubicacionDevolucion });
    return { ok: true, ...result };
  }

  async exportarHistorial(filters = {}) {
    const result = await llaveRepository.findHistorial(filters);
    const registros = (result.data || result).map((registro) => this._toClientFormat(registro));
    return generateExcel(registros, 'Historial Llaves');
  }

  async _formatearPendientes(raw = []) {
    const individuales = await this._filtrarPrestamosIndividuales(raw);
    return individuales.map((registro) => this._toClientFormat(registro));
  }

  async _buscarPersonaPorCarnet(idCarnet) {
    return docenteRepository.findByCarnet(idCarnet);
  }

  async _resolverResultadoDevolucion({ contexto, persona, documento, ubicacion }) {
    try {
      const ubicacionDevolucion = await this._normalizarUbicacionDevolucion(ubicacion);
      const result = await this._ejecutarDevolucion(contexto.prestamoActivo, {
        quien: contexto.rol,
        documento,
        nombre: persona.nombre,
        ubicacion: ubicacionDevolucion,
      });

      return {
        tipo: 'devolucion',
        ...result,
        docente: contexto.docente,
        persona,
        rol: contexto.rol,
        ubicacion: ubicacionDevolucion,
      };
    } catch (err) {
      return {
        tipo: 'error',
        mensaje: err.message,
        docente: contexto.docente,
        persona,
        rol: contexto.rol,
      };
    }
  }

  async _resolverResultadoPrestamo({ contexto, persona, documento, ubicacion }) {
    let ubicacionPrestamo;
    try {
      ubicacionPrestamo = await this._normalizarUbicacionPrestamo(ubicacion);
    } catch (err) {
      return {
        tipo: 'error',
        mensaje: err.message,
        docente: contexto.docente,
        persona,
        rol: contexto.rol,
      };
    }

    if (!contexto.clasesDisponibles.length) {
      return {
        tipo: 'sin_clase',
        mensaje: contexto.mensajeSinClase || 'No hay clases disponibles',
        docente: contexto.docente,
        persona,
        rol: contexto.rol,
      };
    }

    const ahora = new Date();
    const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes();
    const claseTarget = encontrarClaseActual(contexto.clasesDisponibles, minutosAhora);

    if (!claseTarget) {
      return {
        tipo: 'sin_clase',
        mensaje: 'No hay clases en el horario actual o próximo',
        docente: contexto.docente,
        persona,
        rol: contexto.rol,
      };
    }

    const anticipado = esReclamoAnticipado(claseTarget.horario, ahora);
    const tiempoRetraso = calcularTiempoRetraso(claseTarget.horario, ahora);
    const seReclamoATiempo = !tiempoRetraso;

    if (anticipado) {
      return {
        tipo: 'anticipado',
        docente: contexto.docente,
        persona,
        rol: contexto.rol,
        clase: claseTarget,
        se_reclamo_a_tiempo: true,
        mensaje: `${contexto.rol === 'monitor' ? 'El monitor' : 'El docente'} está reclamando la llave con anticipación`,
      };
    }

    const registro = await this._ejecutarPrestamo(
      contexto.docente,
      claseTarget,
      seReclamoATiempo,
      tiempoRetraso,
      {
        quien: contexto.rol,
        documento,
        nombre: persona.nombre,
      },
      'carnet',
      ubicacionPrestamo
    );

    return {
      tipo: 'prestamo',
      docente: contexto.docente,
      persona,
      rol: contexto.rol,
      clase: claseTarget,
      registro,
      ubicacion: ubicacionPrestamo,
      se_reclamo_a_tiempo: seReclamoATiempo,
      tiempo_retraso: tiempoRetraso,
    };
  }

  async _resolverContextoNFC(persona, documento) {
    const diaActual = getDiaActual();
    const [todasClases, registrosHoy] = await Promise.all([
      programacionRepository.findByDia(diaActual),
      llaveRepository.findByFecha(getFechaHoy()),
    ]);

    const clasesDocente = (todasClases || []).filter(
      (clase) => normalizarDocumento(clase.numero_documento) === documento
    );

    if (clasesDocente.length) {
      return this._resolverContextoDocente({ persona, documento, clasesDocente, registrosHoy });
    }

    return this._resolverContextoMonitor({ persona, documento, todasClases, registrosHoy });
  }

  async _resolverContextoDocente({ persona, documento, clasesDocente, registrosHoy }) {
    const prestamoActivo = await llaveRepository.findPendienteByDocumento(documento);
    if (prestamoActivo) {
      return { rol: 'docente', docente: persona, prestamoActivo, clasesDisponibles: [] };
    }

    const horariosProcesados = (registrosHoy || [])
      .filter((registro) => normalizarDocumento(registro.numero_documento) === documento)
      .map((registro) => String(registro.horario || '').trim());

    const clasesDisponibles = agruparClasesConsecutivas(
      (clasesDocente || []).filter(
        (clase) => !horarioCubiertoPorPrestamo(String(clase.horario || '').trim(), horariosProcesados)
      )
    );

    if (!clasesDisponibles.length) {
      return {
        rol: 'docente',
        docente: persona,
        prestamoActivo: null,
        clasesDisponibles: [],
        mensajeSinClase: 'Todas las clases de hoy ya fueron procesadas',
      };
    }

    return { rol: 'docente', docente: persona, prestamoActivo: null, clasesDisponibles };
  }

  async _resolverContextoMonitor({ persona, documento, todasClases, registrosHoy }) {
    const asignaciones = await monitorRepository.findByDocumentoMonitor(documento);
    if (!asignaciones.length) {
      return {
        rol: 'docente',
        docente: persona,
        prestamoActivo: null,
        clasesDisponibles: [],
        mensajeSinClase: 'No tiene clases programadas hoy ni es monitor autorizado',
      };
    }

    for (const asignacion of asignaciones) {
      const docenteDocumento = normalizarDocumento(asignacion.numero_documento_docente);
      const prestamoActivo = await llaveRepository.findPendienteByDocumento(docenteDocumento);
      if (prestamoActivo) {
        const docente = await docenteRepository.findByDocumento(docenteDocumento);
        return {
          rol: 'monitor',
          docente: docente || { numero_documento: docenteDocumento, nombre: asignacion.nombre_docente },
          prestamoActivo,
          clasesDisponibles: [],
        };
      }
    }

    const clasesDisponibles = await this._obtenerClasesDisponiblesMonitor({
      asignaciones,
      todasClases,
      registrosHoy,
    });

    if (!clasesDisponibles.length) {
      return {
        rol: 'monitor',
        docente: persona,
        prestamoActivo: null,
        clasesDisponibles: [],
        mensajeSinClase: 'No hay clases disponibles para este monitor hoy',
      };
    }

    const docenteTitular = await docenteRepository.findByDocumento(
      normalizarDocumento(clasesDisponibles[0].numero_documento)
    );

    return {
      rol: 'monitor',
      docente: docenteTitular || persona,
      prestamoActivo: null,
      clasesDisponibles,
    };
  }

  async _obtenerClasesDisponiblesMonitor({ asignaciones = [], todasClases = [], registrosHoy = [] }) {
    const clasesMonitor = [];

    for (const asignacion of asignaciones) {
      const docenteDocumento = normalizarDocumento(asignacion.numero_documento_docente);
      const clasesDelDocente = (todasClases || []).filter(
        (clase) => normalizarDocumento(clase.numero_documento) === docenteDocumento
          && matchMonitorClase(asignacion, clase)
      );

      const horariosProcesados = (registrosHoy || [])
        .filter((registro) => normalizarDocumento(registro.numero_documento) === docenteDocumento)
        .map((registro) => String(registro.horario || '').trim());

      clasesMonitor.push(
        ...clasesDelDocente.filter(
          (clase) => !horarioCubiertoPorPrestamo(String(clase.horario || '').trim(), horariosProcesados)
        )
      );
    }

    return agruparClasesConsecutivas(clasesMonitor);
  }

  async _buscarClaseParaConfirmacion({ persona, aula, horario, rol }) {
    const documento = normalizarDocumento(persona.numero_documento);
    const esMonitor = rol === 'monitor';
    const clases = await programacionRepository.findByDia(getDiaActual());
    let clase = null;
    let docenteDoc = documento;

    if (esMonitor) {
      const asignaciones = await monitorRepository.findByDocumentoMonitor(documento);
      for (const asignacion of asignaciones) {
        const docenteAsignado = normalizarDocumento(asignacion.numero_documento_docente);
        const clasesEnAula = (clases || []).filter(
          (item) => normalizarDocumento(item.numero_documento) === docenteAsignado
            && String(item.aula || '').trim().toUpperCase() === String(aula || '').trim().toUpperCase()
        );
        const agrupadas = agruparClasesConsecutivas(clasesEnAula);
        clase = agrupadas.find(
          (item) => String(item.horario || '').trim() === String(horario || '').trim()
        );
        if (clase) {
          docenteDoc = docenteAsignado;
          break;
        }
      }
    } else {
      const clasesEnAula = (clases || []).filter(
        (item) => normalizarDocumento(item.numero_documento) === documento
          && String(item.aula || '').trim().toUpperCase() === String(aula || '').trim().toUpperCase()
      );
      const agrupadas = agruparClasesConsecutivas(clasesEnAula);
      clase = agrupadas.find(
        (item) => String(item.horario || '').trim() === String(horario || '').trim()
      );
    }

    return { clase, docenteDoc };
  }

  async _ejecutarPrestamo(docente, clase, seReclamoATiempo, tiempoRetraso, reclamaInfo = {}, tipoEntrega = 'carnet', ubicacionPrestamo = UBICACION_OFICINA) {
    const ahora = new Date();
    const registro = {
      numero_documento: normalizarDocumento(docente.numero_documento),
      docente: docente.nombre || '',
      dia: clase.dia || getDiaActual(),
      horario: clase.horario || '',
      aula: clase.aula || '',
      facultad: clase.facultad || 'No especificada',
      materia: clase.materia || '',
      fecha_hora_entrega: ahora,
      fecha_hora_devolucion: null,
      duracion: '',
      se_reclamo_a_tiempo: seReclamoATiempo,
      tiempo_retraso: tiempoRetraso || '',
      retraso_entrega: false,
      tiempo_retraso_devolucion: '',
      tipo_entrega: tipoEntrega,
      origen_registro: 'programacion',
      ubicacion_prestamo: ubicacionPrestamo,
      ubicacion_devolucion: '',
      quien_reclama: reclamaInfo.quien || 'docente',
      numero_documento_reclama: reclamaInfo.documento || normalizarDocumento(docente.numero_documento),
      nombre_reclama: reclamaInfo.nombre || docente.nombre || '',
      quien_entrega: '',
      numero_documento_entrega: '',
      nombre_entrega: '',
      estado: 'en_prestamo',
    };

    const created = await llaveRepository.create(registro);
    return this._toClientFormat(this._toPlain(created));
  }

  async _ejecutarDevolucion(registro, entregaInfo = {}) {
    const ahora = new Date();
    const fechaEntrega = registro.fecha_hora_entrega instanceof Date
      ? registro.fecha_hora_entrega
      : new Date(registro.fecha_hora_entrega);
    const fechaStr = !Number.isNaN(fechaEntrega.getTime())
      ? fechaEntrega.toISOString().split('T')[0]
      : getFechaHoy();

    const updates = {
      fecha_hora_devolucion: ahora,
      duracion: calcularDuracion(registro.fecha_hora_entrega, ahora),
      tiempo_retraso_devolucion: calcularRetrasoDevolucion(registro.horario, fechaStr, ahora),
      retraso_entrega: !!calcularRetrasoDevolucion(registro.horario, fechaStr, ahora),
      estado: 'entregado',
      ubicacion_devolucion: entregaInfo.ubicacion || UBICACION_OFICINA,
      quien_entrega: entregaInfo.quien || 'docente',
      numero_documento_entrega: entregaInfo.documento || registro.numero_documento,
      nombre_entrega: entregaInfo.nombre || registro.docente,
    };

    const updated = await llaveRepository.update(registro._id, updates);
    return {
      mensaje: `Llave devuelta por ${entregaInfo.nombre || registro.docente}`,
      registro: this._toClientFormat(this._toPlain(updated)),
    };
  }

  _construirRegistroEntregaManual({ infoClase, documento, ubicacionPrestamo, origenRegistro }) {
    const ahora = new Date();
    const horario = (infoClase.hora_inicio && infoClase.hora_fin)
      ? `${infoClase.hora_inicio} A ${infoClase.hora_fin}`
      : '';
    const tiempoRetraso = horario ? calcularTiempoRetraso(horario, ahora) : '';
    const seReclamoATiempo = horario ? !tiempoRetraso : true;

    return {
      numero_documento: documento,
      docente: infoClase.profesor || '',
      dia: getDiaActual(),
      horario,
      aula: infoClase.aula,
      facultad: infoClase.facultad || 'No especificada',
      materia: infoClase.motivo || '',
      fecha_hora_entrega: ahora,
      fecha_hora_devolucion: null,
      duracion: '',
      se_reclamo_a_tiempo: seReclamoATiempo,
      tiempo_retraso: tiempoRetraso,
      retraso_entrega: !seReclamoATiempo,
      tiempo_retraso_devolucion: '',
      tipo_entrega: 'manual',
      origen_registro: origenRegistro,
      ubicacion_prestamo: ubicacionPrestamo,
      ubicacion_devolucion: '',
      quien_reclama: 'docente',
      numero_documento_reclama: documento,
      nombre_reclama: infoClase.profesor || '',
      quien_entrega: '',
      numero_documento_entrega: '',
      nombre_entrega: '',
      estado: 'en_prestamo',
    };
  }

  _validarEntregaManual(infoClase) {
    for (const campo of ['nroidenti', 'profesor', 'aula']) {
      if (!infoClase[campo]) {
        throw ApiError.badRequest(`Campo '${campo}' requerido`);
      }
    }
  }

  _esPrestamoIndividual(registro) {
    return registro?.origen_registro === 'individual';
  }

  async _filtrarPrestamosIndividuales(registros = []) {
    const cacheProgramacionPorDia = new Map();
    const resultado = [];

    for (const registro of registros) {
      if (!this._esPrestamoIndividual(registro)) continue;

      const esProgramacion = await this._coincideConProgramacion(registro, cacheProgramacionPorDia);
      if (esProgramacion) {
        try {
          await llaveRepository.update(registro._id, { origen_registro: 'programacion' });
        } catch (_) {
          // Ignorar autocorrección fallida sin romper la consulta
        }
        continue;
      }

      resultado.push(registro);
    }

    return resultado;
  }

  async _coincideConProgramacion(registro, cacheProgramacionPorDia) {
    const dia = normalizeString(registro?.dia);
    const horario = normalizeHorario(registro?.horario);
    const aula = normalizeAula(registro?.aula);
    const documento = normalizarDocumento(registro?.numero_documento);

    if (!dia || !horario || !aula || !documento) return false;

    if (!cacheProgramacionPorDia.has(dia)) {
      const clasesDia = await programacionRepository.findByDia(dia);
      cacheProgramacionPorDia.set(dia, clasesDia || []);
    }

    const clases = cacheProgramacionPorDia.get(dia) || [];
    return clases.some((clase) => (
      normalizarDocumento(clase.numero_documento) === documento
      && normalizeHorario(clase.horario) === horario
      && normalizeAula(clase.aula) === aula
    ));
  }

  _normalizarOrigenRegistro(origen = 'individual') {
    if (!['individual', 'programacion'].includes(origen)) {
      throw ApiError.badRequest('Origen de préstamo no válido');
    }
    return origen;
  }

  async _normalizarUbicacionPrestamo(ubicacion = UBICACION_OFICINA) {
    return ubicacionService.validarOperacion(ubicacion, OPERACIONES_UBICACION.PRESTAMO_LLAVES);
  }

  async _normalizarUbicacionDevolucion(ubicacion = UBICACION_OFICINA) {
    return ubicacionService.validarOperacion(ubicacion, OPERACIONES_UBICACION.DEVOLUCION_LLAVES);
  }

  _toClientFormat(registro) {
    return toClientFormat(registro, LIMITE_HORAS_DEMORA);
  }

  _toPlain(record) {
    return typeof record?.toObject === 'function' ? record.toObject() : record;
  }
}

module.exports = new LlaveService();