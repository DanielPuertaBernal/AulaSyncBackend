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

      await this._validarDisponibilidad(equiposIds, session);

      const detalles = await Promise.all(
        equiposIds.map(async (id) => {
          const equipo = await equipoRepository.findById(id);
          if (!equipo) throw ApiError.notFound(`Equipo ${id} no encontrado`);
          return {
            equipo_id: new mongoose.Types.ObjectId(id),
            equipo_nombre: equipo.nombre,
            equipo_marca: equipo.marca,
            equipo_codigo: equipo.codigo_inventario,
            equipo_consecutivo: equipo.consecutivo,
            equipo_codigo_barras: equipo.codigo_barras,
            estado_equipo: 'entregado',
            fecha_entrega: new Date(),
            tipo_entrega: 'manual',
          };
        })
      );

      const prestamoAbierto = await prestamoRepository.findActivoByDocente(docente_codigo_nfc, session);
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
    const prestamo = await this.obtener(prestamoId);
    if (prestamo.estado === 'completamente_devuelto') {
      throw ApiError.badRequest('El préstamo ya fue devuelto completamente');
    }

    await this._validarDisponibilidad([equipoId]);
    const equipo = await equipoRepository.findById(equipoId);
    if (!equipo) throw ApiError.notFound('Equipo no encontrado');

    const detalle = {
      equipo_id: new mongoose.Types.ObjectId(equipoId),
      equipo_nombre: equipo.nombre,
      equipo_marca: equipo.marca,
      equipo_codigo: equipo.codigo_inventario,
      equipo_consecutivo: equipo.consecutivo,
      equipo_codigo_barras: equipo.codigo_barras,
      estado_equipo: 'entregado',
      fecha_entrega: new Date(),
      tipo_entrega: 'manual',
    };

    return prestamoRepository.addEquipo(prestamoId, detalle);
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

  async _validarDisponibilidad(equiposIds, session = null) {
    for (const id of equiposIds) {
      const prestado = await prestamoRepository.verificarEquipoPrestado(id, session);
      if (prestado) {
        const eq = await equipoRepository.findById(id);
        throw ApiError.conflict(`El equipo '${eq?.nombre || id}' ya está prestado`);
      }
    }
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
