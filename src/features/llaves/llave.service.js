'use strict';
const llaveRepository = require('./llave.repository');
const docenteRepository = require('../docentes/docente.repository');
const programacionRepository = require('../programacion/programacion.repository');
const monitorRepository = require('../monitores/monitor.repository');
const { generateExcel } = require('../../shared/utils/excel.parser');
const {
  getFechaHoy,
  getDiaActual,
  horaAMinutos,
  calcularRetrasoDevolucion,
  calcularDuracion,
  calcularTiempoRetraso,
  esReclamoAnticipado,
} = require('../../shared/utils/date.helper');

const LIMITE_HORAS_DEMORA = 4;
const UBICACION_OFICINA = 'oficina_centro_servicios_docentes';
const UBICACION_PORTERIA_SUPERIOR = 'porteria_superior';

class LlaveService {
  async obtenerPendientes() {
    const raw = await llaveRepository.findPendientes();
    const individuales = await this._filtrarPrestamosIndividuales(raw);
    return individuales.map((r) => this._toClientFormat(r));
  }

  async obtenerPendientesHoy() {
    const raw = await llaveRepository.findPendientesByFecha(getFechaHoy());
    const individuales = await this._filtrarPrestamosIndividuales(raw);
    return individuales.map((r) => this._toClientFormat(r));
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
      const transformed = aplicarFiltroEstado(fullResult.data.map((r) => this._toClientFormat(r)));
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
      return { data: result.data.map((r) => this._toClientFormat(r)), meta: result.meta };
    }

    return aplicarFiltroEstado(result.data.map((r) => this._toClientFormat(r)));
  }

  async obtenerClasesProcesadasHoy() {
    const registros = await llaveRepository.findByFecha(getFechaHoy());
    return registros.map((r) => ({
      documento: String(r.numero_documento).replace('.0', ''),
      horario: String(r.horario || '').trim(),
    }));
  }

  /**
   * Procesa una lectura NFC: identifica docente o monitor, determina préstamo/devolución
   */
  async procesarLecturaNFC(idCarnet, ubicacion = UBICACION_OFICINA) {
    const persona = await docenteRepository.findByCarnet(idCarnet);
    if (!persona) {
      return { tipo: 'error', mensaje: 'Persona no encontrada para este carnet' };
    }

    const documento = String(persona.numero_documento).replace('.0', '');

    // Verificar si es docente con clase hoy, o monitor autorizado
    const ctx = await this._resolverContextoNFC(persona, documento);

    // Si es docente o monitor con llave prestada del docente → devolución
    if (ctx.prestamoActivo) {
      const result = await this._ejecutarDevolucion(ctx.prestamoActivo, {
        quien: ctx.rol,
        documento,
        nombre: persona.nombre,
        ubicacion: this._normalizarUbicacionDevolucion(ubicacion),
      });
      return { tipo: 'devolucion', ...result, docente: ctx.docente, persona, rol: ctx.rol, ubicacion: this._normalizarUbicacionDevolucion(ubicacion) };
    }

    if (ubicacion !== UBICACION_OFICINA) {
      return {
        tipo: 'error',
        mensaje: 'En la Portería Superior solo se permiten devoluciones de llaves',
        docente: ctx.docente,
        persona,
        rol: ctx.rol,
      };
    }

    if (!ctx.clasesDisponibles.length) {
      return {
        tipo: 'sin_clase',
        mensaje: ctx.mensajeSinClase || 'No hay clases disponibles',
        docente: ctx.docente,
        persona,
        rol: ctx.rol,
      };
    }

    const ahora = new Date();
    const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes();
    const claseTarget = this._encontrarClaseActual(ctx.clasesDisponibles, minutosAhora);

    if (!claseTarget) {
      return { tipo: 'sin_clase', mensaje: 'No hay clases en el horario actual o próximo', docente: ctx.docente, persona, rol: ctx.rol };
    }

    const anticipado = esReclamoAnticipado(claseTarget.horario, ahora);
    const tiempoRetraso = calcularTiempoRetraso(claseTarget.horario, ahora);
    const seReclamoATiempo = !tiempoRetraso;

    if (anticipado) {
      return {
        tipo: 'anticipado',
        docente: ctx.docente,
        persona,
        rol: ctx.rol,
        clase: claseTarget,
        se_reclamo_a_tiempo: true,
        mensaje: `${ctx.rol === 'monitor' ? 'El monitor' : 'El docente'} está reclamando la llave con anticipación`,
      };
    }

    const registro = await this._ejecutarPrestamo(ctx.docente, claseTarget, seReclamoATiempo, tiempoRetraso, {
      quien: ctx.rol,
      documento,
      nombre: persona.nombre,
    }, 'carnet', UBICACION_OFICINA);
    return {
      tipo: 'prestamo',
      docente: ctx.docente,
      persona,
      rol: ctx.rol,
      clase: claseTarget,
      registro,
      ubicacion: UBICACION_OFICINA,
      se_reclamo_a_tiempo: seReclamoATiempo,
      tiempo_retraso: tiempoRetraso,
    };
  }

  /**
   * Resuelve si quien escanea es docente directo o monitor, y encuentra sus clases disponibles
   */
  async _resolverContextoNFC(persona, documento) {
    const diaActual = getDiaActual();
    const todasClases = await programacionRepository.findByDia(diaActual);
    const registrosHoy = await llaveRepository.findByFecha(getFechaHoy());

    // 1) Verificar como docente directo
    const clasesDocente = todasClases.filter(
      (c) => String(c.numero_documento).replace('.0', '') === documento
    );

    if (clasesDocente.length) {
      const prestamoActivo = await llaveRepository.findPendienteByDocumento(documento);
      if (prestamoActivo) {
        return { rol: 'docente', docente: persona, prestamoActivo, clasesDisponibles: [] };
      }

      const horariosProcessados = registrosHoy
        .filter((r) => String(r.numero_documento).replace('.0', '') === documento)
        .map((r) => String(r.horario || '').trim());

      const clasesNoProcessadas = clasesDocente.filter(
        (c) => !this._horarioCubiertoPorPrestamo(String(c.horario || '').trim(), horariosProcessados)
      );
      const clasesDisponibles = this._agruparClasesConsecutivas(clasesNoProcessadas);

      if (!clasesDisponibles.length) {
        return { rol: 'docente', docente: persona, prestamoActivo: null, clasesDisponibles: [], mensajeSinClase: 'Todas las clases de hoy ya fueron procesadas' };
      }
      return { rol: 'docente', docente: persona, prestamoActivo: null, clasesDisponibles };
    }

    // 2) Verificar como monitor
    const asignaciones = await monitorRepository.findByDocumentoMonitor(documento);
    if (!asignaciones.length) {
      return { rol: 'docente', docente: persona, prestamoActivo: null, clasesDisponibles: [], mensajeSinClase: 'No tiene clases programadas hoy ni es monitor autorizado' };
    }

    // Verificar devolución: buscar préstamos activos de los docentes a los que monitorea
    for (const asig of asignaciones) {
      const docDoc = String(asig.numero_documento_docente).replace('.0', '');
      const prestamoActivo = await llaveRepository.findPendienteByDocumento(docDoc);
      if (prestamoActivo) {
        const docente = await docenteRepository.findByDocumento(docDoc);
        return { rol: 'monitor', docente: docente || { numero_documento: docDoc, nombre: asig.nombre_docente }, prestamoActivo, clasesDisponibles: [] };
      }
    }

    // Buscar clases disponibles del monitor para hoy
    const clasesMonitor = [];
    for (const asig of asignaciones) {
      const docDoc = String(asig.numero_documento_docente).replace('.0', '');
      const clasesDelDocente = todasClases.filter(
        (c) => String(c.numero_documento).replace('.0', '') === docDoc
          && this._matchMonitorClase(asig, c)
      );

      const horariosProcessados = registrosHoy
        .filter((r) => String(r.numero_documento).replace('.0', '') === docDoc)
        .map((r) => String(r.horario || '').trim());

      const disponibles = clasesDelDocente.filter(
        (c) => !this._horarioCubiertoPorPrestamo(String(c.horario || '').trim(), horariosProcessados)
      );
      clasesMonitor.push(...disponibles);
    }

    const clasesMonitorAgrupadas = this._agruparClasesConsecutivas(clasesMonitor);

    if (!clasesMonitorAgrupadas.length) {
      return { rol: 'monitor', docente: persona, prestamoActivo: null, clasesDisponibles: [], mensajeSinClase: 'No hay clases disponibles para este monitor hoy' };
    }

    const primerDocDoc = String(clasesMonitorAgrupadas[0].numero_documento).replace('.0', '');
    const docenteTitular = await docenteRepository.findByDocumento(primerDocDoc);

    return { rol: 'monitor', docente: docenteTitular || persona, prestamoActivo: null, clasesDisponibles: clasesMonitorAgrupadas };
  }

  _matchMonitorClase(asignacion, clase) {
    const materiaMatch = String(asignacion.materia || '').trim().toLowerCase() ===
      String(clase.materia || '').trim().toLowerCase();
    if (!materiaMatch) return false;
    if (asignacion.dia && asignacion.horario) {
      return String(asignacion.horario || '').trim() === String(clase.horario || '').trim();
    }
    return true;
  }

  /**
   * Confirma un préstamo anticipado tras aprobación del usuario
   */
  async confirmarPrestamoAnticipado({ id_carnet, horario, aula, rol, documento_persona, nombre_persona, ubicacion = UBICACION_OFICINA }) {
    this._normalizarUbicacionPrestamo(ubicacion);
    const persona = await docenteRepository.findByCarnet(id_carnet);
    if (!persona) throw Object.assign(new Error('Persona no encontrada'), { statusCode: 404 });

    const docDocumento = String(persona.numero_documento).replace('.0', '');
    const esMonitor = rol === 'monitor';

    // Buscar el docente titular de la clase
    const diaActual = getDiaActual();
    const clases = await programacionRepository.findByDia(diaActual);
    let clase = null;
    let docenteDoc = docDocumento;

    if (esMonitor) {
      const asignaciones = await monitorRepository.findByDocumentoMonitor(docDocumento);
      for (const asig of asignaciones) {
        const dd = String(asig.numero_documento_docente).replace('.0', '');
        const clasesEnAula = clases.filter(
          (c) => String(c.numero_documento).replace('.0', '') === dd &&
            String(c.aula || '').trim().toUpperCase() === String(aula || '').trim().toUpperCase()
        );
        const agrupadas = this._agruparClasesConsecutivas(clasesEnAula);
        clase = agrupadas.find(
          (c) => String(c.horario || '').trim() === String(horario || '').trim()
        );
        if (clase) { docenteDoc = dd; break; }
      }
    } else {
      const clasesEnAula = clases.filter(
        (c) => String(c.numero_documento).replace('.0', '') === docDocumento &&
          String(c.aula || '').trim().toUpperCase() === String(aula || '').trim().toUpperCase()
      );
      const agrupadas = this._agruparClasesConsecutivas(clasesEnAula);
      clase = agrupadas.find(
        (c) => String(c.horario || '').trim() === String(horario || '').trim()
      );
    }

    if (!clase) throw Object.assign(new Error('Clase no encontrada en la programación'), { statusCode: 404 });

    const existing = await llaveRepository.findPendienteByDocumento(docenteDoc);
    if (existing) throw Object.assign(new Error('Ya hay una llave prestada para este docente'), { statusCode: 409 });

    const docente = await docenteRepository.findByDocumento(docenteDoc);
    const registro = await this._ejecutarPrestamo(docente || persona, clase, true, '', {
      quien: rol || 'docente',
      documento: documento_persona || docDocumento,
      nombre: nombre_persona || persona.nombre,
    }, 'manual', UBICACION_OFICINA);
    return { ok: true, mensaje: `Llave entregada a ${(docente || persona).nombre}`, registro, docente: docente || persona };
  }

  /**
   * Entrega manual de llave (formulario) - Sin relación con programación
   */
  async registrarEntrega(infoClase) {
    const ubicacionPrestamo = this._normalizarUbicacionPrestamo(infoClase.ubicacion);
    const origenRegistro = this._normalizarOrigenRegistro(infoClase.origen);
    const campos = ['nroidenti', 'profesor', 'aula'];
    for (const c of campos) {
      if (!infoClase[c]) throw Object.assign(new Error(`Campo '${c}' requerido`), { statusCode: 400 });
    }

    const documento = String(infoClase.nroidenti).replace('.0', '');
    const existing = await llaveRepository.findPendienteByDocumento(documento);
    if (existing) throw Object.assign(new Error('El docente ya tiene una llave prestada'), { statusCode: 409 });

    const ahora = new Date();
    const horario = (infoClase.hora_inicio && infoClase.hora_fin)
      ? `${infoClase.hora_inicio} A ${infoClase.hora_fin}`
      : '';
    const tiempoRetraso = horario ? calcularTiempoRetraso(horario, ahora) : '';
    const seReclamoATiempo = horario ? !tiempoRetraso : true;

    const registro = {
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

    const created = await llaveRepository.create(registro);
    return { ok: true, mensaje: `Llave entregada a ${infoClase.profesor}`, registro: this._toClientFormat(created.toObject ? created.toObject() : created) };
  }

  async registrarDevolucion(documento, ubicacion = UBICACION_OFICINA) {
    const doc = String(documento).replace('.0', '');
    const registro = await llaveRepository.findPendienteByDocumento(doc);
    if (!registro) {
      throw Object.assign(new Error('No se encontró llave en préstamo para este docente'), { statusCode: 404 });
    }
    if (ubicacion && ubicacion !== UBICACION_OFICINA) {
      throw Object.assign(new Error('La devolución manual solo se permite en la Oficina Centro de Servicios Docentes'), { statusCode: 400 });
    }
    const result = await this._ejecutarDevolucion(registro, { ubicacion: UBICACION_OFICINA });
    return { ok: true, ...result };
  }

  async exportarHistorial(filters = {}) {
    const result = await llaveRepository.findHistorial(filters);
    const registros = (result.data || result).map((r) => this._toClientFormat(r));
    return generateExcel(registros, 'Historial Llaves');
  }

  // ── Métodos privados ────────────────────────────────────────────────────────

  _encontrarClaseActual(clases, minutosAhora) {
    let mejorClase = null;
    let menorDiff = Infinity;

    for (const clase of clases) {
      const horario = String(clase.horario || '').toUpperCase();
      const partes = horario.split(' A ');
      if (partes.length < 2) continue;
      const inicio = horaAMinutos(partes[0].trim());
      const fin = horaAMinutos(partes[1].trim());
      if (inicio === null || fin === null) continue;

      // Clase en curso o futura del día (no ya terminada)
      if (minutosAhora <= fin) {
        const diff = Math.abs(minutosAhora - inicio);
        if (diff < menorDiff) {
          menorDiff = diff;
          mejorClase = clase;
        }
      }
    }

    return mejorClase;
  }

  async _ejecutarPrestamo(docente, clase, seReclamoATiempo, tiempoRetraso, reclamaInfo = {}, tipoEntrega = 'carnet', ubicacionPrestamo = UBICACION_OFICINA) {
    const ahora = new Date();
    const registro = {
      numero_documento: String(docente.numero_documento).replace('.0', ''),
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
      ubicacion_prestamo: this._normalizarUbicacionPrestamo(ubicacionPrestamo),
      ubicacion_devolucion: '',
      quien_reclama: reclamaInfo.quien || 'docente',
      numero_documento_reclama: reclamaInfo.documento || String(docente.numero_documento).replace('.0', ''),
      nombre_reclama: reclamaInfo.nombre || docente.nombre || '',
      quien_entrega: '',
      numero_documento_entrega: '',
      nombre_entrega: '',
      estado: 'en_prestamo',
    };
    const created = await llaveRepository.create(registro);
    return this._toClientFormat(created.toObject ? created.toObject() : created);
  }

  async _ejecutarDevolucion(registro, entregaInfo = {}) {
    const ahora = new Date();
    const duracion = calcularDuracion(registro.fecha_hora_entrega, ahora);
    const fechaStr = registro.fecha_hora_entrega
      ? registro.fecha_hora_entrega.toISOString().split('T')[0]
      : getFechaHoy();
    const retrasoDevolucion = calcularRetrasoDevolucion(registro.horario, fechaStr, ahora);

    const updates = {
      fecha_hora_devolucion: ahora,
      duracion,
      tiempo_retraso_devolucion: retrasoDevolucion,
      retraso_entrega: !!retrasoDevolucion,
      estado: 'entregado',
      ubicacion_devolucion: this._normalizarUbicacionDevolucion(entregaInfo.ubicacion),
      quien_entrega: entregaInfo.quien || 'docente',
      numero_documento_entrega: entregaInfo.documento || registro.numero_documento,
      nombre_entrega: entregaInfo.nombre || registro.docente,
    };

    const updated = await llaveRepository.update(registro._id, updates);
    return { mensaje: `Llave devuelta por ${entregaInfo.nombre || registro.docente}`, registro: this._toClientFormat(updated) };
  }

  _horarioCubiertoPorPrestamo(horarioClase, horariosProcessados) {
    const partes = String(horarioClase || '').toUpperCase().split(' A ');
    const claseInicio = horaAMinutos(partes[0]?.trim());
    const claseFin = horaAMinutos(partes[1]?.trim());
    if (claseInicio === null || claseFin === null) return false;

    return horariosProcessados.some((hp) => {
      const p = String(hp || '').toUpperCase().split(' A ');
      const pInicio = horaAMinutos(p[0]?.trim());
      const pFin = horaAMinutos(p[1]?.trim());
      if (pInicio === null || pFin === null) return false;
      return claseInicio >= pInicio && claseFin <= pFin;
    });
  }

  _agruparClasesConsecutivas(clases) {
    const grupos = new Map();
    for (const c of clases) {
      const doc = String(c.numero_documento || '').replace('.0', '');
      const aula = String(c.aula || '').trim().toUpperCase();
      const key = `${doc}||${aula}`;
      if (!grupos.has(key)) grupos.set(key, []);
      grupos.get(key).push(c);
    }

    const resultado = [];
    for (const bloques of grupos.values()) {
      if (bloques.length === 1) {
        resultado.push(bloques[0]);
        continue;
      }

      bloques.sort((a, b) => {
        const ha = String(a.horario || '').toUpperCase().split(' A ')[0]?.trim();
        const hb = String(b.horario || '').toUpperCase().split(' A ')[0]?.trim();
        return (horaAMinutos(ha) ?? 0) - (horaAMinutos(hb) ?? 0);
      });

      let actual = { ...bloques[0] };
      let materias = [actual.materia || ''];

      for (let i = 1; i < bloques.length; i++) {
        const sig = bloques[i];
        const finActualStr = String(actual.horario || '').toUpperCase().split(' A ')[1]?.trim();
        const inicioSigStr = String(sig.horario || '').toUpperCase().split(' A ')[0]?.trim();
        const finActual = horaAMinutos(finActualStr);
        const inicioSig = horaAMinutos(inicioSigStr);

        if (finActual !== null && inicioSig !== null && finActual === inicioSig) {
          const horaIni = String(actual.horario || '').toUpperCase().split(' A ')[0]?.trim();
          const horaFin = String(sig.horario || '').toUpperCase().split(' A ')[1]?.trim();
          actual.horario = `${horaIni} A ${horaFin}`;
          actual.hora_fin = horaFin;
          materias.push(sig.materia || '');
        } else {
          actual.materia = [...new Set(materias.filter(Boolean))].join(', ');
          resultado.push(actual);
          actual = { ...sig };
          materias = [sig.materia || ''];
        }
      }

      actual.materia = [...new Set(materias.filter(Boolean))].join(', ');
      resultado.push(actual);
    }

    return resultado;
  }

  _toClientFormat(r) {
    const formatDate = (d) => (d instanceof Date ? d.toISOString().split('T')[0] : '');
    const formatTime = (d) => (d instanceof Date ? d.toTimeString().split(' ')[0] : '');
    const estadoCalculado = this._calcularEstadoVisual(r);

    return {
      _id: r._id,
      documento: String(r.numero_documento).replace('.0', ''),
      docente: r.docente,
      dia: r.dia,
      horario: r.horario,
      aula: r.aula,
      facultad: r.facultad,
      materia: r.materia,
      fechaEntrega: formatDate(r.fecha_hora_entrega),
      horaEntrega: formatTime(r.fecha_hora_entrega),
      fechaDevolucion: formatDate(r.fecha_hora_devolucion),
      horaDevolucion: formatTime(r.fecha_hora_devolucion),
      duracion: r.duracion,
      seReclamoATiempo: r.se_reclamo_a_tiempo,
      tiempoRetraso: r.tiempo_retraso,
      retrasoEntrega: r.retraso_entrega,
      tiempoRetrasoDevolucion: r.tiempo_retraso_devolucion,
      ubicacionPrestamo: r.ubicacion_prestamo || '',
      ubicacionDevolucion: r.ubicacion_devolucion || '',
      quienReclama: r.quien_reclama || '',
      documentoReclama: r.numero_documento_reclama || '',
      nombreReclama: r.nombre_reclama || '',
      quienEntrega: r.quien_entrega || '',
      documentoEntrega: r.numero_documento_entrega || '',
      nombreEntrega: r.nombre_entrega || '',
      tipoEntrega: r.tipo_entrega || '',
      origenRegistro: r.origen_registro || '',
      estado: estadoCalculado,
    };
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
        // Autocorrección de datos históricos mal clasificados
        try {
          await llaveRepository.update(registro._id, { origen_registro: 'programacion' });
        } catch (_) {
          // Si falla la corrección persistente, igual no mostramos el registro como individual
        }
        continue;
      }

      resultado.push(registro);
    }

    return resultado;
  }

  async _coincideConProgramacion(registro, cacheProgramacionPorDia) {
    const dia = String(registro?.dia || '').trim();
    const horario = String(registro?.horario || '').trim().toUpperCase();
    const aula = String(registro?.aula || '').trim().toUpperCase();
    const documento = String(registro?.numero_documento || '').replace('.0', '').trim();

    if (!dia || !horario || !aula || !documento) return false;

    if (!cacheProgramacionPorDia.has(dia)) {
      const clasesDia = await programacionRepository.findByDia(dia);
      cacheProgramacionPorDia.set(dia, clasesDia || []);
    }

    const clases = cacheProgramacionPorDia.get(dia) || [];
    return clases.some((c) => (
      String(c.numero_documento || '').replace('.0', '').trim() === documento
      && String(c.horario || '').trim().toUpperCase() === horario
      && String(c.aula || '').trim().toUpperCase() === aula
    ));
  }

  _normalizarOrigenRegistro(origen = 'individual') {
    if (!['individual', 'programacion'].includes(origen)) {
      throw Object.assign(new Error('Origen de préstamo no válido'), { statusCode: 400 });
    }
    return origen;
  }

  _calcularEstadoVisual(r) {
    if (r.fecha_hora_devolucion) {
      return 'entregado';
    }

    const estadoActual = r.estado || '';
    if (estadoActual !== 'en_prestamo') return estadoActual;

    const fechaEntrega = r.fecha_hora_entrega instanceof Date
      ? r.fecha_hora_entrega
      : (r.fecha_hora_entrega ? new Date(r.fecha_hora_entrega) : null);
    if (!fechaEntrega || Number.isNaN(fechaEntrega.getTime())) return estadoActual;

    const horario = String(r.horario || '').toUpperCase().split(' A ');
    if (horario.length < 2) return estadoActual;

    const finMinutos = horaAMinutos(String(horario[1] || '').trim());
    if (finMinutos === null) return estadoActual;

    const finClase = new Date(fechaEntrega);
    finClase.setHours(Math.floor(finMinutos / 60), finMinutos % 60, 0, 0);

    const umbralDemora = new Date(finClase.getTime() + (LIMITE_HORAS_DEMORA * 60 * 60 * 1000));
    return new Date() > umbralDemora ? 'demora_entrega' : estadoActual;
  }

  _normalizarUbicacionPrestamo(ubicacion = UBICACION_OFICINA) {
    if (ubicacion !== UBICACION_OFICINA) {
      throw Object.assign(new Error('Los préstamos y entregas solo se registran en la Oficina Centro de Servicios Docentes'), { statusCode: 400 });
    }
    return UBICACION_OFICINA;
  }

  _normalizarUbicacionDevolucion(ubicacion = UBICACION_OFICINA) {
    if (![UBICACION_OFICINA, UBICACION_PORTERIA_SUPERIOR].includes(ubicacion)) {
      throw Object.assign(new Error('Ubicación de devolución no válida'), { statusCode: 400 });
    }
    return ubicacion;
  }
}

module.exports = new LlaveService();
