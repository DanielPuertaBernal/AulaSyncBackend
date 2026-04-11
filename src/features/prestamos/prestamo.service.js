'use strict';
/**
 * Prestamo Service
 * Equivale a: application/services/prestamo_service.py
 *           + application/services/devolucion_service.py
 */
const mongoose = require('mongoose');
const ApiError = require('../../shared/errors/api.error');
const { prestamoRepository, devolucionRepository } = require('./prestamo.repository');
const equipoRepository = require('../equipos/equipo.repository');
const ubicacionService = require('../ubicaciones/ubicacion.service');
const {
  OPERACIONES_UBICACION,
  UBICACIONES: { OFICINA: UBICACION_OFICINA },
} = require('../../shared/constants/nfc.constants');

class PrestamoService {
  async listar() { return prestamoRepository.findAll(); }
  async activos() { return prestamoRepository.findActivos(); }
  async porDocente(codigoNfc) { return prestamoRepository.findByDocente(codigoNfc); }

  async obtener(id) {
    const p = await prestamoRepository.findById(id);
    if (!p) throw ApiError.notFound('Préstamo no encontrado');
    return p;
  }

  /**
   * Crea un nuevo préstamo de equipos
   * Equivale a PréstamoService.crear_prestamo (Python)
   * @param {object} datos
   */
  async crear({ docente_codigo_nfc, docente_nombre, equipos, auxiliar_prestamista, ubicacion_prestamo = UBICACION_OFICINA }) {
    if (!equipos || !equipos.length) {
      throw ApiError.badRequest('Debe prestar al menos un equipo');
    }

    const ubicacionPrestamo = await this._validarUbicacionOperacion(
      ubicacion_prestamo,
      'La ubicación seleccionada no está autorizada para préstamos de equipos'
    );

    const equiposIds = this._normalizarEquipos(equipos);
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      const equiposMap = await this._cargarEquiposDisponibles(equiposIds, session);
      const prestamoAbierto = await prestamoRepository.findActivoByDocente(docente_codigo_nfc, session);
      this._validarNoDuplicadosEnPrestamo(prestamoAbierto, equiposIds, equiposMap);

      const detalles = equiposIds.map((id) => this._crearDetalleEquipo(equiposMap.get(String(id))));

      let prestamo;
      if (prestamoAbierto) {
        prestamo = await prestamoRepository.update(
          prestamoAbierto._id,
          {
            docente_nombre: docente_nombre || prestamoAbierto.docente_nombre,
            auxiliar_prestamista: auxiliar_prestamista || prestamoAbierto.auxiliar_prestamista || 'Auxiliar',
            ubicacion_prestamo: ubicacionPrestamo,
            equipos: [...(prestamoAbierto.equipos || []), ...detalles],
          },
          session
        );
      } else {
        prestamo = await prestamoRepository.create({
          docente_codigo_nfc,
          docente_nombre,
          auxiliar_prestamista: auxiliar_prestamista || 'Auxiliar',
          ubicacion_prestamo: ubicacionPrestamo,
          equipos: detalles,
          estado: 'activo',
        }, session);
      }

      await session.commitTransaction();
      return prestamo;
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }

  /**
   * Agrega un equipo adicional a un préstamo existente
   */
  async agregarEquipo(prestamoId, equipoId, auxiliar) {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      const prestamo = await prestamoRepository.findById(prestamoId, session);
      if (!prestamo) throw ApiError.notFound('Préstamo no encontrado');
      if (prestamo.estado === 'completamente_devuelto') {
        throw ApiError.badRequest('El préstamo ya fue devuelto completamente');
      }

      const equiposMap = await this._cargarEquiposDisponibles([equipoId], session);
      this._validarNoDuplicadosEnPrestamo(prestamo, [equipoId], equiposMap);

      const equipo = equiposMap.get(String(equipoId));
      const detalle = this._crearDetalleEquipo(equipo);
      const updated = await prestamoRepository.addEquipo(prestamoId, detalle, session);

      await session.commitTransaction();
      return updated;
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }

  /**
   * Registra devolución (parcial o completa)
   * Equivale a DevolucionService.crear_devolucion (Python)
   */
  async registrarDevolucion({
    prestamo_id,
    docente_codigo_nfc,
    docente_nombre,
    equipos,
    auxiliar_que_recibio,
    ubicacion_devolucion = UBICACION_OFICINA,
  }) {
    const prestamo = await this.obtener(prestamo_id);
    if (prestamo.estado === 'completamente_devuelto') {
      throw ApiError.badRequest('El préstamo ya fue devuelto completamente');
    }

    const ubicacionDevolucion = await this._validarUbicacionOperacion(
      ubicacion_devolucion,
      'La ubicación seleccionada no está autorizada para devoluciones de equipos'
    );

    const equiposADevolver = equipos && equipos.length
      ? this._normalizarEquipos(equipos)
      : prestamo.equipos
          .filter((e) => e.estado_equipo === 'entregado')
          .map((e) => String(e.equipo_id));

    const now = new Date();
    const equiposDevueltos = [];

    const equiposActualizados = prestamo.equipos.map((eq) => {
      const strId = String(eq.equipo_id);
      if (equiposADevolver.includes(strId) && eq.estado_equipo === 'entregado') {
        equiposDevueltos.push({
          equipo_id: eq.equipo_id,
          nombre: eq.equipo_nombre,
          cantidad: 1,
          estado: 'bueno',
        });
        return {
          ...eq,
          estado_equipo: 'devuelto',
          fecha_devolucion: now,
          auxiliar_que_recibio_devolucion: auxiliar_que_recibio || 'Auxiliar',
        };
      }
      return eq;
    });

    if (!equiposDevueltos.length) {
      throw ApiError.badRequest('No hay equipos entregados que coincidan con la devolución solicitada');
    }

    const aunEntregados = equiposActualizados.filter((e) => e.estado_equipo === 'entregado');
    const esCompleta = aunEntregados.length === 0;
    const nuevoEstado = esCompleta ? 'completamente_devuelto' : 'parcialmente_devuelto';

    const session = await mongoose.startSession();
    try {
      session.startTransaction();

      await prestamoRepository.update(prestamo_id, {
        equipos: equiposActualizados,
        estado: nuevoEstado,
      }, session);

      const devolucion = await devolucionRepository.create({
        prestamo_id: new mongoose.Types.ObjectId(prestamo_id),
        docente_codigo_nfc,
        docente_nombre,
        ubicacion_devolucion: ubicacionDevolucion,
        equipos_devueltos: equiposDevueltos,
        auxiliar_que_recibio: auxiliar_que_recibio || 'Auxiliar',
        es_devolucion_completa: esCompleta,
      }, session);

      await session.commitTransaction();
      return { devolucion, prestamo_estado: nuevoEstado };
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }

  _normalizarEquipos(equipos) {
    const normalizados = equipos.map((item) => {
      if (typeof item === 'string') return item;
      if (typeof item === 'object') {
        return String(item.equipo_id || item._id || item.id || '');
      }
      return String(item);
    }).filter(Boolean);
    return [...new Set(normalizados)];
  }

  _crearDetalleEquipo(equipo, tipoEntrega = 'manual') {
    if (!equipo) throw ApiError.notFound('Equipo no encontrado');

    return {
      equipo_id: new mongoose.Types.ObjectId(equipo._id),
      equipo_nombre: equipo.nombre,
      equipo_marca: equipo.marca,
      equipo_codigo: equipo.codigo_inventario,
      equipo_consecutivo: equipo.consecutivo,
      equipo_codigo_barras: equipo.codigo_barras,
      estado_equipo: 'entregado',
      fecha_entrega: new Date(),
      tipo_entrega: tipoEntrega || 'manual',
    };
  }

  async _cargarEquiposDisponibles(equiposIds, session = null) {
    const equipos = await equipoRepository.findByIds(equiposIds, session);
    const equiposMap = new Map(equipos.map((equipo) => [String(equipo._id), equipo]));

    const faltantes = equiposIds.filter((id) => !equiposMap.has(String(id)));
    if (faltantes.length) {
      throw ApiError.notFound(`Equipos no encontrados: ${faltantes.join(', ')}`);
    }

    const noPrestables = equipos
      .filter((equipo) => equipo.estado !== 'activo')
      .map((equipo) => equipo.nombre || equipo.codigo_inventario || String(equipo._id));

    if (noPrestables.length) {
      throw ApiError.conflict(`Los equipos ${noPrestables.join(', ')} no están disponibles para préstamo`);
    }

    await this._validarDisponibilidad(equiposIds, session, equiposMap);
    return equiposMap;
  }

  async _validarDisponibilidad(equiposIds, session = null, equiposMap = null) {
    const prestamosActivos = await prestamoRepository.findEquiposPrestados(equiposIds, session);
    const idsPrestados = new Set();

    for (const prestamo of prestamosActivos) {
      for (const equipo of prestamo.equipos || []) {
        const equipoId = String(equipo.equipo_id);
        if (equipo.estado_equipo === 'entregado' && equiposIds.includes(equipoId)) {
          idsPrestados.add(equipoId);
        }
      }
    }

    if (!idsPrestados.size) return;

    const nombres = [...idsPrestados].map((id) => {
      const equipo = equiposMap?.get(id);
      return equipo?.nombre || equipo?.codigo_inventario || id;
    });

    throw ApiError.conflict(`Los equipos ${nombres.join(', ')} ya están prestados`);
  }

  _validarNoDuplicadosEnPrestamo(prestamo, equiposIds, equiposMap = null) {
    if (!prestamo?.equipos?.length) return;

    const equiposActivos = new Set(
      prestamo.equipos
        .filter((equipo) => equipo.estado_equipo === 'entregado')
        .map((equipo) => String(equipo.equipo_id))
    );

    const duplicados = equiposIds.filter((id) => equiposActivos.has(String(id)));
    if (!duplicados.length) return;

    const nombres = duplicados.map((id) => {
      const equipo = equiposMap?.get(String(id));
      return equipo?.nombre || equipo?.codigo_inventario || id;
    });

    throw ApiError.conflict(`El préstamo ya incluye los equipos: ${nombres.join(', ')}`);
  }

  async _validarUbicacionOperacion(ubicacion, mensaje) {
    try {
      return await ubicacionService.validarOperacion(ubicacion, OPERACIONES_UBICACION.PRESTAMO_EQUIPOS);
    } catch (err) {
      throw new ApiError(mensaje || err.message, err.statusCode || 400);
    }
  }
}

module.exports = new PrestamoService();
